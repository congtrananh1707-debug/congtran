// Vietnamese lunar calendar conversion.
//
// Adapted from Hồ Ngọc Đức's well-known JavaScript implementation
// (https://www.informatik.uni-leipzig.de/~duc/amlich/) — public domain.
// Uses time zone +7 (Asia/Ho_Chi_Minh) for Vietnamese lunar dates.
//
// Public API:
//   solarToLunar(year, month, day) → { lunarDay, lunarMonth, lunarYear, leap }
//   lunarToSolar(lunarDay, lunarMonth, lunarYear, leap)
//     → { year, month, day }
//
// Note: day/month are 1-based on both sides.

const TZ = 7 // Asia/Ho_Chi_Minh
const PI = Math.PI

function INT(d: number): number {
  return Math.floor(d)
}

// Julian day number for a Gregorian date.
function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12)
  const y = yy + 4800 - a
  const m = mm + 12 * a - 3
  let jd =
    dd +
    INT((153 * m + 2) / 5) +
    365 * y +
    INT(y / 4) -
    INT(y / 100) +
    INT(y / 400) -
    32045
  if (jd < 2299161) {
    jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083
  }
  return jd
}

function jdToDate(jd: number): { day: number; month: number; year: number } {
  let a: number, b: number, c: number
  if (jd > 2299160) {
    a = jd + 32044
    b = INT((4 * a + 3) / 146097)
    c = a - INT((b * 146097) / 4)
  } else {
    b = 0
    c = jd + 32082
  }
  const d = INT((4 * c + 3) / 1461)
  const e = c - INT((1461 * d) / 4)
  const m = INT((5 * e + 2) / 153)
  const day = e - INT((153 * m + 2) / 5) + 1
  const month = m + 3 - 12 * INT(m / 10)
  const year = b * 100 + d - 4800 + INT(m / 10)
  return { day, month, year }
}

function getNewMoonDay(k: number, timeZone: number): number {
  const T = k / 1236.85
  const T2 = T * T
  const T3 = T2 * T
  const dr = PI / 180
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3
  Jd1 = Jd1 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr)
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M)
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr)
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr)
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr))
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M))
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr))
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M))
  let deltat: number
  if (T < -11) {
    deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2
  }
  const JdNew = Jd1 + C1 - deltat
  return INT(JdNew + 0.5 + timeZone / 24)
}

function getSunLongitude(jdn: number, timeZone: number): number {
  const T = (jdn - 2451545.5 - timeZone / 24) / 36525
  const T2 = T * T
  const dr = PI / 180
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M)
  DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M)
  let L = L0 + DL
  L = L * dr
  L = L - PI * 2 * INT(L / (PI * 2))
  return INT((L / PI) * 6)
}

function getLunarMonth11(yy: number, timeZone: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021
  const k = INT(off / 29.530588853)
  let nm = getNewMoonDay(k, timeZone)
  const sunLong = getSunLongitude(nm, timeZone)
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone)
  }
  return nm
}

function getLeapMonthOffset(a11: number, timeZone: number): number {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5)
  let last = 0
  let i = 1
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone)
  do {
    last = arc
    i++
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone)
  } while (arc !== last && i < 14)
  return i - 1
}

export type LunarDate = { lunarDay: number; lunarMonth: number; lunarYear: number; leap: boolean }

export function solarToLunar(year: number, month: number, day: number): LunarDate {
  const dayNumber = jdFromDate(day, month, year)
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853)
  let monthStart = getNewMoonDay(k + 1, TZ)
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k, TZ)
  }
  let a11 = getLunarMonth11(year, TZ)
  let b11 = a11
  let lunarYear: number
  if (a11 >= monthStart) {
    lunarYear = year
    a11 = getLunarMonth11(year - 1, TZ)
  } else {
    lunarYear = year + 1
    b11 = getLunarMonth11(year + 1, TZ)
  }
  const lunarDay = dayNumber - monthStart + 1
  const diff = INT((monthStart - a11) / 29)
  let lunarLeap = false
  let lunarMonth = diff + 11
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, TZ)
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10
      if (diff === leapMonthDiff) lunarLeap = true
    }
  }
  if (lunarMonth > 12) lunarMonth = lunarMonth - 12
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1
  return { lunarDay, lunarMonth, lunarYear, leap: lunarLeap }
}

export function lunarToSolar(
  lunarDay: number,
  lunarMonth: number,
  lunarYear: number,
  leap: boolean = false,
): { year: number; month: number; day: number } {
  let a11: number, b11: number
  if (lunarMonth < 11) {
    a11 = getLunarMonth11(lunarYear - 1, TZ)
    b11 = getLunarMonth11(lunarYear, TZ)
  } else {
    a11 = getLunarMonth11(lunarYear, TZ)
    b11 = getLunarMonth11(lunarYear + 1, TZ)
  }
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853)
  let off = lunarMonth - 11
  if (off < 0) off += 12
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11, TZ)
    let leapMonth = leapOff - 2
    if (leapMonth < 0) leapMonth += 12
    if (leap && lunarMonth !== leapMonth) {
      // Requested leap of a non-leap month — fall back to non-leap
    } else if (leap || off >= leapOff) {
      off += 1
    }
  }
  const monthStart = getNewMoonDay(k + off, TZ)
  return jdToDate(monthStart + lunarDay - 1)
}

// Convenience: get the next upcoming solar date matching a given lunar
// day/month (no specific year), starting from `from`. Returns the Date.
export function nextSolarForLunar(
  lunarDay: number,
  lunarMonth: number,
  from: Date = new Date(),
): Date {
  for (let yearOffset = 0; yearOffset < 3; yearOffset++) {
    const ly = from.getFullYear() + yearOffset
    const { year, month, day } = lunarToSolar(lunarDay, lunarMonth, ly, false)
    const d = new Date(year, month - 1, day)
    if (d >= new Date(from.getFullYear(), from.getMonth(), from.getDate())) return d
  }
  // Fallback — should never hit
  const { year, month, day } = lunarToSolar(lunarDay, lunarMonth, from.getFullYear() + 1, false)
  return new Date(year, month - 1, day)
}
