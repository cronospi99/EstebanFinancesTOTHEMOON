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

/**
 * Un logotipo con su nombre: sirve igual para una gestora y para una empresa.
 * Son la misma cosa en pantalla —la imagen de la insignia— y solo se
 * diferencian en de dónde cuelgan: el fondo lo hereda de quien lo emite, la
 * acción lo tiene por sí misma.
 */
export type Logotipo = Issuer

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
  EMXC EFA EEM TLT IEF SHY LQD HYG TIP GOVT SGOV IAU IBIT ETHA
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
  MOTI VNM IDX SMHX
`)

registrar('avantis', `
  AVUV AVDV AVUS AVEM AVDE AVLV AVMV AVSC AVIG AVSD AVES AVNM AVGV AVGE
  AVSE AVMU AVRE AVIV AVSF
`)

/**
 * Nombre oficial de mercado, ticker a ticker.
 *
 * Va en el código y no solo en el proveedor a propósito: la búsqueda de
 * nombres depende de una API que puede estar caída o bloqueada —lo ha estado
 * desde los servidores de despliegue— y entonces la posición se quedaba
 * llamándose como su ticker. Una tabla local acierta al instante y sin red;
 * lo que no esté aquí sigue preguntándole al proveedor.
 *
 * Cubre **todos** los tickers registrados arriba con gestora: si un símbolo
 * tiene logotipo, tiene nombre. Tenerlo a medias era lo peor de los dos
 * mundos, porque la fila salía con el logotipo de Vanguard y el nombre «VBR».
 *
 * Los encabezados `# Gestora` son solo para leerla; el lector los salta.
 */
const NOMBRES_RAW = `
# Vanguard
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
VBR|Vanguard Small-Cap Value ETF
VBK|Vanguard Small-Cap Growth ETF
VOE|Vanguard Mid-Cap Value ETF
VOT|Vanguard Mid-Cap Growth ETF
BND|Vanguard Total Bond Market ETF
BNDX|Vanguard Total International Bond ETF
BSV|Vanguard Short-Term Bond ETF
BIV|Vanguard Intermediate-Term Bond ETF
BLV|Vanguard Long-Term Bond ETF
VCIT|Vanguard Intermediate-Term Corporate Bond ETF
VCSH|Vanguard Short-Term Corporate Bond ETF
VCLT|Vanguard Long-Term Corporate Bond ETF
VGIT|Vanguard Intermediate-Term Treasury ETF
VGSH|Vanguard Short-Term Treasury ETF
VGLT|Vanguard Long-Term Treasury ETF
VTEB|Vanguard Tax-Exempt Bond ETF
VTIP|Vanguard Short-Term Inflation-Protected Securities ETF
VMBS|Vanguard Mortgage-Backed Securities ETF
VDE|Vanguard Energy ETF
VHT|Vanguard Health Care ETF
VPU|Vanguard Utilities ETF
VAW|Vanguard Materials ETF
VIS|Vanguard Industrials ETF
VFH|Vanguard Financials ETF
VCR|Vanguard Consumer Discretionary ETF
VDC|Vanguard Consumer Staples ETF
VOX|Vanguard Communication Services ETF
VSS|Vanguard FTSE All-World ex-US Small-Cap ETF
VEU|Vanguard FTSE All-World ex-US ETF
VSGX|Vanguard ESG International Stock ETF
VOOG|Vanguard S&P 500 Growth ETF
VOOV|Vanguard S&P 500 Value ETF
VXF|Vanguard Extended Market ETF
VV|Vanguard Large-Cap ETF

# iShares
IVV|iShares Core S&P 500 ETF
IEFA|iShares Core MSCI EAFE ETF
IEMG|iShares Core MSCI Emerging Markets ETF
AGG|iShares Core U.S. Aggregate Bond ETF
IJR|iShares Core S&P Small-Cap ETF
IJH|iShares Core S&P Mid-Cap ETF
IWM|iShares Russell 2000 ETF
IWF|iShares Russell 1000 Growth ETF
IWD|iShares Russell 1000 Value ETF
IWB|iShares Russell 1000 ETF
IWV|iShares Russell 3000 ETF
ITOT|iShares Core S&P Total U.S. Stock Market ETF
IXUS|iShares Core MSCI Total International Stock ETF
IUSB|iShares Core Total USD Bond Market ETF
IUSV|iShares Core S&P U.S. Value ETF
IUSG|iShares Core S&P U.S. Growth ETF
EMXC|iShares MSCI Emerging Markets ex China ETF
EFA|iShares MSCI EAFE ETF
EEM|iShares MSCI Emerging Markets ETF
TLT|iShares 20+ Year Treasury Bond ETF
IEF|iShares 7-10 Year Treasury Bond ETF
SHY|iShares 1-3 Year Treasury Bond ETF
LQD|iShares iBoxx Investment Grade Corporate Bond ETF
HYG|iShares iBoxx High Yield Corporate Bond ETF
TIP|iShares TIPS Bond ETF
GOVT|iShares U.S. Treasury Bond ETF
SGOV|iShares 0-3 Month Treasury Bond ETF
IAU|iShares Gold Trust
IBIT|iShares Bitcoin Trust
ETHA|iShares Ethereum Trust ETF
SOXX|iShares Semiconductor ETF
IGV|iShares Expanded Tech-Software Sector ETF
IYW|iShares U.S. Technology ETF
IYH|iShares U.S. Healthcare ETF
IYF|iShares U.S. Financials ETF
IYR|iShares U.S. Real Estate ETF
ICLN|iShares Global Clean Energy ETF
IDRV|iShares Self-Driving EV and Tech ETF
USMV|iShares MSCI USA Min Vol Factor ETF
QUAL|iShares MSCI USA Quality Factor ETF
MTUM|iShares MSCI USA Momentum Factor ETF
VLUE|iShares MSCI USA Value Factor ETF
SIZE|iShares MSCI USA Size Factor ETF
ESGU|iShares ESG Aware MSCI USA ETF
EFAV|iShares MSCI EAFE Min Vol Factor ETF
EEMV|iShares MSCI Emerging Markets Min Vol Factor ETF
ACWI|iShares MSCI ACWI ETF
ACWX|iShares MSCI ACWI ex U.S. ETF
IEUR|iShares Core MSCI Europe ETF
IPAC|iShares Core MSCI Pacific ETF

# State Street (SPDR)
SPY|SPDR S&P 500 ETF Trust
SPLG|SPDR Portfolio S&P 500 ETF
SPYG|SPDR Portfolio S&P 500 Growth ETF
SPYV|SPDR Portfolio S&P 500 Value ETF
SPYD|SPDR Portfolio S&P 500 High Dividend ETF
SPMD|SPDR Portfolio S&P 400 Mid Cap ETF
SPSM|SPDR Portfolio S&P 600 Small Cap ETF
SPTM|SPDR Portfolio S&P 1500 Composite Stock Market ETF
SPDW|SPDR Portfolio Developed World ex-US ETF
SPEM|SPDR Portfolio Emerging Markets ETF
SPAB|SPDR Portfolio Aggregate Bond ETF
SPIB|SPDR Portfolio Intermediate Term Corporate Bond ETF
SPTI|SPDR Portfolio Intermediate Term Treasury ETF
SPTL|SPDR Portfolio Long Term Treasury ETF
DIA|SPDR Dow Jones Industrial Average ETF Trust
MDY|SPDR S&P MidCap 400 ETF Trust
GLD|SPDR Gold Shares
GLDM|SPDR Gold MiniShares Trust
XLK|Technology Select Sector SPDR Fund
XLF|Financial Select Sector SPDR Fund
XLE|Energy Select Sector SPDR Fund
XLV|Health Care Select Sector SPDR Fund
XLY|Consumer Discretionary Select Sector SPDR Fund
XLP|Consumer Staples Select Sector SPDR Fund
XLI|Industrial Select Sector SPDR Fund
XLB|Materials Select Sector SPDR Fund
XLU|Utilities Select Sector SPDR Fund
XLRE|Real Estate Select Sector SPDR Fund
XLC|Communication Services Select Sector SPDR Fund

# Charles Schwab
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
SCHZ|Schwab U.S. Aggregate Bond ETF
SCHR|Schwab Intermediate-Term U.S. Treasury ETF
SCHO|Schwab Short-Term U.S. Treasury ETF
SCHQ|Schwab Long-Term U.S. Treasury ETF
SCHY|Schwab International Dividend Equity ETF
SCHI|Schwab 5-10 Year Corporate Bond ETF
SCHJ|Schwab 1-5 Year Corporate Bond ETF
SCHK|Schwab 1000 Index ETF
SCHM|Schwab U.S. Mid-Cap ETF
FNDX|Schwab Fundamental U.S. Large Company ETF
FNDA|Schwab Fundamental U.S. Small Company ETF
FNDF|Schwab Fundamental International Equity ETF
FNDE|Schwab Fundamental Emerging Markets Equity ETF
FNDC|Schwab Fundamental International Small Company ETF

# J.P. Morgan
JEPI|JPMorgan Equity Premium Income ETF
JEPQ|JPMorgan Nasdaq Equity Premium Income ETF
JPST|JPMorgan Ultra-Short Income ETF
JMST|JPMorgan Ultra-Short Municipal Income ETF
JCPB|JPMorgan Core Plus Bond ETF
JPIE|JPMorgan Income ETF
JGRO|JPMorgan Active Growth ETF
JQUA|JPMorgan U.S. Quality Factor ETF
JVAL|JPMorgan U.S. Value Factor ETF
JMOM|JPMorgan U.S. Momentum Factor ETF
JMIN|JPMorgan U.S. Minimum Volatility ETF
JIRE|JPMorgan International Research Enhanced Equity ETF
JMEE|JPMorgan Market Expansion Enhanced Equity ETF
BBUS|JPMorgan BetaBuilders U.S. Equity ETF
BBIN|JPMorgan BetaBuilders International Equity ETF
BBAG|JPMorgan BetaBuilders U.S. Aggregate Bond ETF
BBEU|JPMorgan BetaBuilders Europe ETF
BBJP|JPMorgan BetaBuilders Japan ETF
BBCA|JPMorgan BetaBuilders Canada ETF
BBAX|JPMorgan BetaBuilders Developed Asia Pacific ex-Japan ETF
BBSA|JPMorgan BetaBuilders 1-5 Year U.S. Aggregate Bond ETF

# VanEck
SMH|VanEck Semiconductor ETF
MOAT|VanEck Morningstar Wide Moat ETF
GDX|VanEck Gold Miners ETF
GDXJ|VanEck Junior Gold Miners ETF
OIH|VanEck Oil Services ETF
BIZD|VanEck BDC Income ETF
ANGL|VanEck Fallen Angel High Yield Bond ETF
HYEM|VanEck Emerging Markets High Yield Bond ETF
EMLC|VanEck J.P. Morgan EM Local Currency Bond ETF
HYD|VanEck High Yield Muni ETF
ITM|VanEck Intermediate Muni ETF
PPH|VanEck Pharmaceutical ETF
BBH|VanEck Biotech ETF
ESPO|VanEck Video Gaming and eSports ETF
REMX|VanEck Rare Earth and Strategic Metals ETF
MOTI|VanEck Morningstar International Moat ETF
VNM|VanEck Vietnam ETF
IDX|VanEck Indonesia Index ETF
SMHX|VanEck Fabless Semiconductor ETF

# Avantis
AVUV|Avantis U.S. Small Cap Value ETF
AVDV|Avantis International Small Cap Value ETF
AVUS|Avantis U.S. Equity ETF
AVEM|Avantis Emerging Markets Equity ETF
AVDE|Avantis International Equity ETF
AVLV|Avantis U.S. Large Cap Value ETF
AVMV|Avantis U.S. Mid Cap Value ETF
AVSC|Avantis U.S. Small Cap Equity ETF
AVIG|Avantis Core Fixed Income ETF
AVSD|Avantis Responsible International Equity ETF
AVES|Avantis Emerging Markets Value ETF
AVNM|Avantis All International Markets Equity ETF
AVGV|Avantis All Equity Markets Value ETF
AVGE|Avantis All Equity Markets ETF
AVSE|Avantis Responsible Emerging Markets Equity ETF
AVMU|Avantis Core Municipal Fixed Income ETF
AVRE|Avantis Real Estate ETF
AVIV|Avantis International Large Cap Value ETF
AVSF|Avantis Short-Term Fixed Income ETF

# Otros fondos
QQQ|Invesco QQQ Trust
QQQM|Invesco NASDAQ 100 ETF
RSP|Invesco S&P 500 Equal Weight ETF
ARKK|ARK Innovation ETF
GDXY|YieldMax Gold Miners Option Income Strategy ETF

# Acciones
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

# Cripto
BTC-USD|Bitcoin
ETH-USD|Ethereum
SOL-USD|Solana
USDT-USD|Tether
USDC-USD|USD Coin
`

// La tabla se lee saltando encabezados (`# Gestora`) y líneas en blanco: son
// lo que la hace legible con doscientas y pico entradas, y sin filtrarlas la
// primera línea sin `|` reventaba el módulo entero al importarlo.
const NOMBRES: Record<string, string> = Object.fromEntries(
  NOMBRES_RAW.split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('|'))
    .map((l) => {
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

/** Emisora de un símbolo, si se conoce. Solo fondos. */
export function issuerOf(symbol: string): Issuer | undefined {
  const id = POR_TICKER[symbol.trim().toUpperCase()]
  return id ? ISSUERS[id] : undefined
}

/**
 * Logotipo propio de una empresa, para las acciones sueltas.
 *
 * Va aparte de ISSUERS porque no es lo mismo: Vanguard le presta su logotipo a
 * cuarenta y ocho fondos, mientras que el de Apple es de AAPL y de nada más.
 * Mezclarlos invitaría a colgar de «Apple» cualquier cosa que empiece por AA.
 *
 * Mapa explícito, por el mismo motivo que el de gestoras: sin reglas.
 */
const EMPRESAS: Record<string, Logotipo> = {
  AAPL: { id: 'apple', name: 'Apple', logo: '/brands/apple.png' },
  MSFT: { id: 'microsoft', name: 'Microsoft', logo: '/brands/microsoft.png' },
  GOOGL: { id: 'google', name: 'Google', logo: '/brands/google.png' },
  GOOG: { id: 'google', name: 'Google', logo: '/brands/google.png' },
  TTWO: { id: 'take-two', name: 'Take-Two Interactive', logo: '/brands/take-two.png' },
  SNDK: { id: 'sandisk', name: 'SanDisk', logo: '/brands/sandisk.png' },
}

/**
 * El logotipo que le toca a un símbolo: el de su gestora si es un fondo, el de
 * su empresa si es una acción. Es lo que necesita la insignia, que no tiene
 * por qué saber de cuál de los dos vino.
 *
 * La gestora manda cuando hay las dos: un fondo se reconoce por quien lo
 * emite, y el ticker de un fondo no es el de ninguna empresa de la lista.
 */
export function logotipoDe(symbol: string): Logotipo | undefined {
  return issuerOf(symbol) ?? EMPRESAS[symbol.trim().toUpperCase()]
}
