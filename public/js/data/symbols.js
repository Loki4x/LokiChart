// Daftar simbol terpadu. Setiap simbol dipetakan ke kode instrumen tiap broker.
export const SYMBOLS = [
  { symbol: 'XAUUSD', desc: 'Gold / U.S. Dollar', type: 'commodity cfd', icon: 'gold', oanda: 'XAU_USD', forexcom: 'XAU/USD', base: 3550, digits: 2 },
  { symbol: 'XAGUSD', desc: 'Silver / U.S. Dollar', type: 'commodity cfd', icon: 'silver', oanda: 'XAG_USD', forexcom: 'XAG/USD', base: 42, digits: 3 },
  { symbol: 'EURUSD', desc: 'Euro / U.S. Dollar', type: 'forex', icon: 'fx', oanda: 'EUR_USD', forexcom: 'EUR/USD', base: 1.08, digits: 5 },
  { symbol: 'GBPUSD', desc: 'British Pound / U.S. Dollar', type: 'forex', icon: 'fx', oanda: 'GBP_USD', forexcom: 'GBP/USD', base: 1.27, digits: 5 },
  { symbol: 'USDJPY', desc: 'U.S. Dollar / Japanese Yen', type: 'forex', icon: 'fx', oanda: 'USD_JPY', forexcom: 'USD/JPY', base: 159.2, digits: 3 },
  { symbol: 'AUDUSD', desc: 'Australian Dollar / U.S. Dollar', type: 'forex', icon: 'fx', oanda: 'AUD_USD', forexcom: 'AUD/USD', base: 0.66, digits: 5 },
  { symbol: 'USDCHF', desc: 'U.S. Dollar / Swiss Franc', type: 'forex', icon: 'fx', oanda: 'USD_CHF', forexcom: 'USD/CHF', base: 0.88, digits: 5 },
  { symbol: 'USDCAD', desc: 'U.S. Dollar / Canadian Dollar', type: 'forex', icon: 'fx', oanda: 'USD_CAD', forexcom: 'USD/CAD', base: 1.37, digits: 5 },
  { symbol: 'NZDUSD', desc: 'New Zealand Dollar / U.S. Dollar', type: 'forex', icon: 'fx', oanda: 'NZD_USD', forexcom: 'NZD/USD', base: 0.6, digits: 5 },
  { symbol: 'EURJPY', desc: 'Euro / Japanese Yen', type: 'forex', icon: 'fx', oanda: 'EUR_JPY', forexcom: 'EUR/JPY', base: 171, digits: 3 },
  { symbol: 'GBPJPY', desc: 'British Pound / Japanese Yen', type: 'forex', icon: 'fx', oanda: 'GBP_JPY', forexcom: 'GBP/JPY', base: 201, digits: 3 },
  { symbol: 'USDIDR', desc: 'U.S. Dollar / Indonesian Rupiah', type: 'forex', icon: 'fx', oanda: null, forexcom: 'USD/IDR', base: 16500, digits: 0 },
  { symbol: 'BTCUSD', desc: 'Bitcoin / U.S. Dollar', type: 'crypto cfd', icon: 'btc', oanda: 'BTC_USD', forexcom: 'BTC/USD', base: 96000, digits: 1 },
  { symbol: 'ETHUSD', desc: 'Ethereum / U.S. Dollar', type: 'crypto cfd', icon: 'eth', oanda: 'ETH_USD', forexcom: 'ETH/USD', base: 3400, digits: 2 },
  { symbol: 'US30', desc: 'US Wall St 30', type: 'index cfd', icon: 'index', oanda: 'US30_USD', forexcom: 'US 30', base: 44000, digits: 1 },
  { symbol: 'NAS100', desc: 'US Tech 100', type: 'index cfd', icon: 'index', oanda: 'NAS100_USD', forexcom: 'US Tech 100', base: 20500, digits: 1 },
  { symbol: 'SPX500', desc: 'US SPX 500', type: 'index cfd', icon: 'index', oanda: 'SPX500_USD', forexcom: 'US SP 500', base: 5900, digits: 1 },
  { symbol: 'DE40', desc: 'Germany 40', type: 'index cfd', icon: 'index', oanda: 'DE30_EUR', forexcom: 'Germany 40', base: 19500, digits: 1 },
  { symbol: 'WTICO', desc: 'West Texas Oil', type: 'commodity cfd', icon: 'oil', oanda: 'WTICO_USD', forexcom: 'US Crude Oil', base: 69, digits: 2 },
  { symbol: 'USDX', desc: 'U.S. Dollar Index', type: 'index cfd', icon: 'usd', oanda: null, forexcom: 'US Dollar Basket', base: 106, digits: 3 },
];

// Timeframe yang didukung (detik)
export const TIMEFRAMES = {
  '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
  '1h': 3600, '2h': 7200, '4h': 14400, '1D': 86400, '1W': 604800,
};

export function findSymbol(sym) {
  return SYMBOLS.find(s => s.symbol === String(sym).toUpperCase());
}
