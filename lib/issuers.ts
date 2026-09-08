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

/** Emisora de un símbolo, si se conoce. */
export function issuerOf(symbol: string): Issuer | undefined {
  const id = POR_TICKER[symbol.trim().toUpperCase()]
  return id ? ISSUERS[id] : undefined
}
