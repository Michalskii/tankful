export {}

declare global {
  type MapkaSettings = Record<string, any>
  type MapkaData = Record<string, any>
  type MapkaPlace = { cc?: string | null; region?: string | null; regionName?: string | null }
  type MapkaGeo = { origin: MapkaPlace | null; dest: MapkaPlace | null; shares: Record<string, number> | null }
  type MapkaPrice = { low: number; high: number; unit: string; auto: boolean; source: string }

  const MAPKA_LOCALE: string
  const MAPKA_CURRENCY: string
  const MAPKA_CURRENCIES: string[]
  const MAPKA_FUELS: Record<string, string>
  const MAPKA_DEFAULTS: MapkaSettings
  const MAPKA_DATA_KEYS: MapkaData
  const MAPKA_REGIONS: Record<string, string>
  const MAPKA_US_STATES: Record<string, [string, string]>

  function mapkaT(key: string, ...subs: unknown[]): string
  function mapkaResolvePrice(s: MapkaSettings, data: MapkaData, geo: MapkaGeo | null): MapkaPrice
  function mapkaRouteShares(points: { lat: number; lng: number }[]): Record<string, number> | null
  function mapkaLocalPricePln(s: MapkaSettings, data: MapkaData, geo: MapkaPlace): { price: number; label: string } | null
  function mapkaFromPln(pln: number, currency: string, data: MapkaData): number | null
  function mapkaFormatMoney(value: number, currency: string): string
  function mapkaFormatUnitPrice(value: number, currency: string): string
  function mapkaFormatNumber(value: number, maxDigits?: number): string
  function mapkaUnit(fuelType: string, units?: string): string
  function mapkaConsumptionLabel(fuelType: string, units?: string): string
  function mapkaConsumptionUnit(fuelType: string, units?: string): string
  function mapkaDistanceUnit(units?: string): string
  function mapkaToDistance(km: number, units?: string): number
  function mapkaFormatDistance(km: number, units?: string, maxDigits?: number): string
  function mapkaToVolume(amount: number, fuelType: string, units?: string): number
  function mapkaToUnitPrice(perUnit: number, fuelType: string, units?: string): number
  function mapkaFromUnitPrice(shown: number, fuelType: string, units?: string): number
  function mapkaToConsumption(metric: number, fuelType: string, units?: string): number
  function mapkaFromConsumption(shown: number, fuelType: string, units?: string): number
  function mapkaRoundConsumption(metric: number, fuelType: string, units?: string): number
  function mapkaCountryName(cc: string): string
  function mapkaStartPrice(pln: number, currency: string): number
  function mapkaFallbackPrice(currency: string): number
}
