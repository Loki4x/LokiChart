#!/usr/bin/env python3
"""Buat keystore Android yang SELALU SAMA dari satu kata sandi (Secret SIGNING_PASSPHRASE).

Kata sandi yang sama -> kunci RSA & sertifikat yang sama -> APK baru bisa meng-update APK lama.
Pemakaian: SIGNING_PASSPHRASE=... python3 derive_keystore.py keluar.p12
"""
import datetime, hashlib, os, sys
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

ALIAS = b'lokichart'


class Drbg:
    """Aliran byte deterministik dari kata sandi (PBKDF2 + SHA-256 mode counter)."""
    def __init__(self, passphrase: str):
        self.seed = hashlib.pbkdf2_hmac('sha256', passphrase.encode(), b'lokichart-apk-signing-v1', 300_000)
        self.n = 0

    def bytes(self, k: int) -> bytes:
        out = b''
        while len(out) < k:
            out += hashlib.sha256(self.seed + self.n.to_bytes(8, 'big')).digest()
            self.n += 1
        return out[:k]

    def int(self, bits: int) -> int:
        return int.from_bytes(self.bytes(bits // 8), 'big')


def is_probable_prime(n: int, rng: Drbg, rounds: int = 40) -> bool:
    if n < 2:
        return False
    for p in (2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37):
        if n % p == 0:
            return n == p
    d, s = n - 1, 0
    while d % 2 == 0:
        d //= 2
        s += 1
    for _ in range(rounds):
        a = 2 + rng.int(n.bit_length() + 64) % (n - 3)
        x = pow(a, d, n)
        if x in (1, n - 1):
            continue
        for _ in range(s - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return False
    return True


def gen_prime(rng: Drbg, bits: int, e: int) -> int:
    while True:
        c = rng.int(bits) | (1 << (bits - 1)) | (1 << (bits - 2)) | 1
        if (c - 1) % e != 0 and is_probable_prime(c, rng):
            return c


def main():
    pw = os.environ.get('SIGNING_PASSPHRASE', '')
    if len(pw) < 12:
        sys.exit('SIGNING_PASSPHRASE minimal 12 karakter')
    rng, e = Drbg(pw), 65537
    p = gen_prime(rng, 1024, e)
    q = gen_prime(rng, 1024, e)
    while q == p:
        q = gen_prime(rng, 1024, e)
    if p < q:
        p, q = q, p
    phi = (p - 1) * (q - 1)
    d = pow(e, -1, phi)
    key = rsa.RSAPrivateNumbers(p, q, d, rsa.rsa_crt_dmp1(d, p), rsa.rsa_crt_dmq1(d, q), rsa.rsa_crt_iqmp(p, q),
                                rsa.RSAPublicNumbers(e, p * q)).private_key()
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'LokiChart'), x509.NameAttribute(NameOID.ORGANIZATION_NAME, 'LokiChart')])
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
            .serial_number(int.from_bytes(hashlib.sha256(rng.seed).digest()[:8], 'big'))
            .not_valid_before(datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc))
            .not_valid_after(datetime.datetime(2076, 1, 1, tzinfo=datetime.timezone.utc))
            .sign(key, hashes.SHA256()))
    data = pkcs12.serialize_key_and_certificates(ALIAS, key, cert, None, serialization.BestAvailableEncryption(pw.encode()))
    open(sys.argv[1], 'wb').write(data)
    print('Sidik jari sertifikat (SHA-256):', cert.fingerprint(hashes.SHA256()).hex()[:32], '…')


if __name__ == '__main__':
    main()
