import express from 'express'
import { chromium, Browser } from 'playwright'

const app = express()
const PORT = process.env.PORT || 3000

function getToday(): string {
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo" }))
    const dd = String(today.getDate()).padStart(2, '0')
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const yyyy = today.getFullYear()
    return `${dd}-${mm}-${yyyy}`
}

const WAIT_SHORT = 1000
const WAIT_MEDIUM = 3000
const WAIT_LONG = 8000

let browser: Browser | null = null
async function getBrowser() {
    if (!browser) {
        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-extensions',
                '--disable-gpu',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-background-networking',
                '--disable-sync',
            ],
        })
        console.log('✅ Chromium launched once')
    }
    return browser
}

let cache: { date: string; message: string; timestamp: number } | null = null
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

async function getCachedShowtimes(date: string) {
    if (cache && cache.date === date && Date.now() - cache.timestamp < CACHE_TTL) {
        console.log('⚡ Using cached showtimes')
        return cache.message
    }
    const message = await fetchShowtimes(date)
    cache = { date, message, timestamp: Date.now() }
    return message
}

async function fetchShowtimes(formattedDate: string) {
    const browser = await getBrowser()
    const page = await browser.newPage()

    await page.goto('https://kccmultiplex.lk/buy-tickets/', { waitUntil: 'domcontentloaded' })

    const dateSelector = `input[name="date"][value="${formattedDate}"]`
    const labelSelector = `label[for="date-${formattedDate}"]`
    try {
        await page.waitForSelector(dateSelector, { state: 'attached', timeout: WAIT_MEDIUM })
        const label = page.locator(labelSelector)
        await label.scrollIntoViewIfNeeded()
        await label.click({ force: true })
    } catch {
        await page.close()
        return `⚠️ Date ${formattedDate} not available`
    }

    await Promise.race([
        page.getByRole('heading', { name: /select a movie/i }).waitFor({ timeout: WAIT_LONG }),
        page.waitForTimeout(WAIT_LONG),
    ])

    await page.waitForSelector('input[name="movie"]', { state: 'attached', timeout: WAIT_LONG })

    const movies = await page.evaluate(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>('input[name="movie"]')
        return Array.from(inputs).map((input) => ({
            id: input.id,
            title: document.querySelector(`label[for="${input.id}"]`)?.textContent?.trim(),
        }))
    })

    const results: Record<string, any> = {}

    for (const movie of movies) {
        if (!movie.title) continue
        const movieLabel = `label[for="${movie.id}"]`
        await page.locator(movieLabel).click({ force: true })
        await page.waitForTimeout(WAIT_SHORT)

        await Promise.race([
            page.waitForSelector('input[name="cinema"]', { timeout: WAIT_MEDIUM }),
            page.waitForTimeout(WAIT_SHORT),
        ]).catch(() => null)

        const cinemas = await page.evaluate(() => {
            const cinemaInputs = document.querySelectorAll<HTMLInputElement>('input[name="cinema"]')
            return Array.from(cinemaInputs).map((cinema) => ({
                id: cinema.id,
                name: document.querySelector(`label[for="${cinema.id}"]`)?.textContent?.trim(),
            }))
        })

        const cinemaResults: Record<string, string[]> = {}

        for (const cinema of cinemas) {
            if (!cinema.name) continue
            const cinemaLabel = `label[for="${cinema.id}"]`
            await page.locator(cinemaLabel).click({ force: true })
            await page.waitForTimeout(WAIT_SHORT)

            const showtimes = await page.evaluate(() => {
                const timeEls = document.querySelectorAll(
                    '.showtimes button, [class*="showtime"] button, label[for^="showtime-"]'
                )
                return Array.from(timeEls)
                    .map((el) => el.textContent?.trim())
                    .filter(Boolean)
            })

            cinemaResults[cinema.name] = showtimes.length ? showtimes : ['No showtimes available']
        }

        results[movie.title] = cinemaResults
    }

    await page.close()

    let summary = `🎬 KCC Multiplex showtimes for ${formattedDate}:\n\n`
    for (const [movie, cinemas] of Object.entries(results)) {
        summary += `🎞️ ${movie}\n`
        for (const [cinema, times] of Object.entries(cinemas)) {
            summary += `  🍿 ${cinema}: ${(times as string[]).join(', ')}\n`
        }
        summary += '\n'
    }

    return summary.trim()
}

app.get('/kcc', async (req, res) => {
    try {
        const date = getToday()
        const message = await getCachedShowtimes(date)
        res.json({ date, message })
    } catch (err: any) {
        res.status(500).json({ error: err.message })
    }
})

app.get('/kcc/siri', async (req, res) => {
    try {
        const date = getToday()
        const message = await getCachedShowtimes(date)
        res.setHeader('Content-Type', 'text/plain')
        res.send(message)
    } catch (err: any) {
        res.status(500).send('Sorry, I could not get the showtimes right now.')
    }
})

app.listen(PORT, () => console.log(`🚀 KCC API running on port ${PORT}`))
