/**
 * Emisoras de fondos: quién está detrás de un ETF.
 *
 * Un ticker no dice nada por sí solo —VOO, IVV y SPLG siguen los tres al S&P
 * 500— pero el logotipo de la gestora sí se reconoce de un vistazo en una
 * lista. El mapa es explícito y no usa prefijos a propósito: reglas del tipo
 * «empieza por AV → Avantis» le pondrían el logotipo de una gestora a AVGO,
 * que es Broadcom, y una acción disfrazada de fondo es peor que ningún icono.
 */

export interface Issuer {
  id: string
  name: string
  logo: string
}

export const ISSUERS: Record<string, Issuer> = {
  vanguard: { id: 'vanguard', name: 'Vanguard', logo: '/issuers/vanguard.png' },
  ishares: { id: 'ishares', name: 'iShares', logo: '/issuers/ishares.png' },
  'state-street': { id: 'state-street', name: 'State Street', logo: '/issuers/state-street.png' },
  schwab: { id: 'schwab', name: 'Charles Schwab', logo: '/issuers/schwab.png' },
  jpmorgan: { id: 'jpmorgan', name: 'J.P. Morgan', logo: '/issuers/jpmorgan.png' },
  vaneck: { id: 'vaneck', name: 'VanEck', logo: '/issuers/vaneck.png' },
  avantis: { id: 'avantis', name: 'Avantis', logo: '/issuers/avantis.png' },
}

/** Ticker → emisora. Solo fondos; las acciones sueltas no tienen gestora. */
const POR_TICKER: Record<string, string> = {}

const registrar = (issuer: string, tickers: string) => {
  for (const t of tickers.split(/\s+/).filter(Boolean)) POR_TICKER[t] = issuer
}

registrar('vanguard', `
  VOO VTI VT VXUS VEA VWO VUG VTV VIG VYM VNQ VGT VB VO VBR VBK VOE VOT
  BND BNDX BSV BIV BLV VCIT VCSH VCLT VGIT VGSH VGLT VTEB VTIP VMBS
  VDE VHT VPU VAW VIS VFH VCR VDC VOX VSS VEU VSGX VOOG VOOV VXF VV
`)

registrar('ishares', `
  IVV IEFA IEMG AGG IJR IJH IWM IWF IWD IWB IWV ITOT IXUS IUSB IUSV IUSG
  EFA EEM TLT IEF SHY LQD HYG TIP GOVT SGOV IAU IBIT ETHA
  SOXX IGV IYW IYH IYF IYR ICLN IDRV
  USMV QUAL MTUM VLUE SIZE ESGU EFAV EEMV ACWI ACWX IEUR IPAC
`)

registrar('state-street', `
  SPY SPLG SPYG SPYV SPYD SPMD SPSM SPTM SPDW SPEM SPAB SPIB SPTI SPTL
  DIA MDY GLD GLDM XLK XLF XLE XLV XLY XLP XLI XLB XLU XLRE XLC
`)

registrar('schwab', `
  SCHD SCHB SCHX SCHG SCHV SCHA SCHF SCHE SCHH SCHP SCHZ SCHR SCHO SCHQ
  SCHY SCHI SCHJ SCHK SCHM FNDX FNDA FNDF FNDE FNDC
`)

registrar('jpmorgan', `
  JEPI JEPQ JPST JMST JCPB JPIE JGRO JQUA JVAL JMOM JMIN JIRE JMEE
  BBUS BBIN BBAG BBEU BBJP BBCA BBAX BBSA
`)

registrar('vaneck', `
  SMH MOAT GDX GDXJ OIH BIZD ANGL HYEM EMLC HYD ITM PPH BBH ESPO REMX
  MOTI VNM IDX SMHX GDXY
`)

registrar('avantis', `
  AVUV AVDV AVUS AVEM AVDE AVLV AVMV AVSC AVIG AVSD AVES AVNM AVGV AVGE
  AVSE AVMU AVRE AVIV AVSF
`)

/**
 * Nombre oficial de los instrumentos habituales.
 *
 * Va en el código y no solo en el proveedor a propósito: la búsqueda de
 * nombres depende de una API que puede estar caída o bloqueada —lo está ahora
 * mismo desde los servidores de despliegue— y entonces la posición se quedaba
 * llamándose como su ticker. Una tabla local acierta al instante y sin red
 * para lo que de verdad se compra; lo que no esté aquí sigue preguntándole al
 * proveedor.
 */
const NOMBRES_RAW = `
VOO|Vanguard S&P 500 ETF
VTI|Vanguard Total Stock Market ETF
VT|Vanguard Total World Stock ETF
VXUS|Vanguard Total International Stock ETF
VEA|Vanguard FTSE Developed Markets ETF
VWO|Vanguard FTSE Emerging Markets ETF
VUG|Vanguard Growth ETF
VTV|Vanguard Value ETF
VIG|Vanguard Dividend Appreciation ETF
VYM|Vanguard High Dividend Yield ETF
VNQ|Vanguard Real Estate ETF
VGT|Vanguard Information Technology ETF
VB|Vanguard Small-Cap ETF
VO|Vanguard Mid-Cap ETF
VV|Vanguard Large-Cap ETF
BND|Vanguard Total Bond Market ETF
BNDX|Vanguard Total International Bond ETF
VCIT|Vanguard Intermediate-Term Corporate Bond ETF
VCSH|Vanguard Short-Term Corporate Bond ETF
VTEB|Vanguard Tax-Exempt Bond ETF
IVV|iShares Core S&P 500 ETF
IEFA|iShares Core MSCI EAFE ETF
IEMG|iShares Core MSCI Emerging Markets ETF
AGG|iShares Core U.S. Aggregate Bond ETF
IJR|iShares Core S&P Small-Cap ETF
IJH|iShares Core S&P Mid-Cap ETF
IWM|iShares Russell 2000 ETF
IWF|iShares Russell 1000 Growth ETF
IWD|iShares Russell 1000 Value ETF
ITOT|iShares Core S&P Total U.S. Stock Market ETF
IXUS|iShares Core MSCI Total International Stock ETF
EFA|iShares MSCI EAFE ETF
EEM|iShares MSCI Emerging Markets ETF
TLT|iShares 20+ Year Treasury Bond ETF
SGOV|iShares 0-3 Month Treasury Bond ETF
LQD|iShares iBoxx Investment Grade Corporate Bond ETF
HYG|iShares iBoxx High Yield Corporate Bond ETF
IAU|iShares Gold Trust
IBIT|iShares Bitcoin Trust
SOXX|iShares Semiconductor ETF
IGV|iShares Expanded Tech-Software Sector ETF
QUAL|iShares MSCI USA Quality Factor ETF
USMV|iShares MSCI USA Min Vol Factor ETF
ACWI|iShares MSCI ACWI ETF
SPY|SPDR S&P 500 ETF Trust
SPLG|SPDR Portfolio S&P 500 ETF
SPYG|SPDR Portfolio S&P 500 Growth ETF
SPYV|SPDR Portfolio S&P 500 Value ETF
SPYD|SPDR Portfolio S&P 500 High Dividend ETF
DIA|SPDR Dow Jones Industrial Average ETF Trust
MDY|SPDR S&P MidCap 400 ETF Trust
GLD|SPDR Gold Shares
GLDM|SPDR Gold MiniShares Trust
XLK|Technology Select Sector SPDR Fund
XLF|Financial Select Sector SPDR Fund
XLE|Energy Select Sector SPDR Fund
XLV|Health Care Select Sector SPDR Fund
SCHD|Schwab U.S. Dividend Equity ETF
SCHB|Schwab U.S. Broad Market ETF
SCHX|Schwab U.S. Large-Cap ETF
SCHG|Schwab U.S. Large-Cap Growth ETF
SCHV|Schwab U.S. Large-Cap Value ETF
SCHA|Schwab U.S. Small-Cap ETF
SCHF|Schwab International Equity ETF
SCHE|Schwab Emerging Markets Equity ETF
SCHH|Schwab U.S. REIT ETF
SCHP|Schwab U.S. TIPS ETF
JEPI|JPMorgan Equity Premium Income ETF
JEPQ|JPMorgan Nasdaq Equity Premium Income ETF
JPST|JPMorgan Ultra-Short Income ETF
BBUS|JPMorgan BetaBuilders U.S. Equity ETF
SMH|VanEck Semiconductor ETF
MOAT|VanEck Morningstar Wide Moat ETF
GDX|VanEck Gold Miners ETF
GDXJ|VanEck Junior Gold Miners ETF
AVUV|Avantis U.S. Small Cap Value ETF
AVDV|Avantis International Small Cap Value ETF
AVUS|Avantis U.S. Equity ETF
AVEM|Avantis Emerging Markets Equity ETF
AVLV|Avantis U.S. Large Cap Value ETF
EMXC|iShares MSCI Emerging Markets ex China ETF
QQQ|Invesco QQQ Trust
QQQM|Invesco NASDAQ 100 ETF
RSP|Invesco S&P 500 Equal Weight ETF
ARKK|ARK Innovation ETF
VOOG|Vanguard S&P 500 Growth ETF
VOOV|Vanguard S&P 500 Value ETF
AAPL|Apple Inc.
MSFT|Microsoft Corporation
NVDA|NVIDIA Corporation
GOOGL|Alphabet Inc. Class A
GOOG|Alphabet Inc. Class C
AMZN|Amazon.com Inc.
META|Meta Platforms Inc.
TSLA|Tesla Inc.
AVGO|Broadcom Inc.
BRK-B|Berkshire Hathaway Inc. Class B
JPM|JPMorgan Chase & Co.
V|Visa Inc.
MA|Mastercard Incorporated
COST|Costco Wholesale Corporation
KO|The Coca-Cola Company
PEP|PepsiCo Inc.
DIS|The Walt Disney Company
NFLX|Netflix Inc.
AMD|Advanced Micro Devices Inc.
INTC|Intel Corporation
SNDK|SanDisk Corporation
TTWO|Take-Two Interactive Software Inc.
BTC-USD|Bitcoin
ETH-USD|Ethereum
SOL-USD|Solana
USDT-USD|Tether
USDC-USD|USD Coin
`

const NOMBRES: Record<string, string> = Object.fromEntries(
  NOMBRES_RAW.trim().split('\n').map((l) => {
    const [t, n] = l.split('|')
    return [t.trim(), n.trim()]
  }),
)

/** Nombre oficial de un ticker conocido, sin pasar por la red. */
export const nombreDe = (symbol: string): string | undefined =>
  NOMBRES[symbol.trim().toUpperCase()]

/**
 * Nombre a mostrar de una posición.
 *
 * Prioriza el que se guardó, pero cae a la tabla local cuando lo guardado es
 * el propio ticker: eso es lo que quedó grabado en las posiciones creadas
 * mientras la búsqueda de nombres estaba caída, y arreglarlo al pintar evita
 * tener que tocar los datos.
 */
export function nombreVisible(symbol: string, guardado?: string): string {
  const s = symbol.trim().toUpperCase()
  if (guardado && guardado.trim().toUpperCase() !== s) return guardado
  return nombreDe(s) ?? guardado ?? s
}

/** Emisora de un símbolo, si se conoce. */
export function issuerOf(symbol: string): Issuer | undefined {
  const id = POR_TICKER[symbol.trim().toUpperCase()]
  return id ? ISSUERS[id] : undefined
}
