const NUMERIC_DAYS = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/i

export function toDatePosted(value: string | number): string | undefined {
    const input = String(value).trim()
    if (!input) return undefined

    let date: Date
    if (typeof value === "number" || NUMERIC_DAYS.test(input)) {
        const days = Number(input)
        if (!Number.isFinite(days)) return undefined
        date = new Date(Date.now() - days * 86400e3)
    } else {
        if (!ISO_DATE.test(input)) return undefined
        const datePart = input.slice(0, 10)
        const calendarDate = new Date(`${datePart}T00:00:00.000Z`)
        if (isNaN(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== datePart) return undefined
        const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(input)
        date = new Date(input.includes("T") && !hasTimezone ? `${input}Z` : input)
    }

    return isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10)
}