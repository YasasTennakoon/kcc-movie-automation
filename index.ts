import express from 'express'
import { chromium } from 'playwright'

const app = express()
const PORT = process.env.PORT || 3000

//For now added need bring the option to pass respective dates
function getToday(): string {
    const today = new Date()
    const dd = String(today.getDate()).padStart(2, '0')
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const yyyy = today.getFullYear()
    return `${dd}-${mm}-${yyyy}`
}

async function fetchShowtimes(formattedDate: string) {
    const browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()

    await page.goto('https://kccmultiplex.lk/buy-tickets/', { waitUntil: 'domcontentloaded' })

    const dateSelector = `input[name="date"][value="${formattedDate}"]`
    const labelSelector = `label[for="date-${formattedDate}"]`
    try {
        await page.waitForSelector(dateSelector, { state: 'attached', timeout: 15000 })
        const label = page.locator(labelSelector)
        await label.scrollIntoViewIfNeeded()
        await label.click({ force: true })
    } catch {
        await browser.close()
        return { error: `Date ${formattedDate} not available` }
    }

    await page.getByRole('heading', { name: /select a movie/i }).waitFor({ timeout: 10 })
    await page.waitForSelector('input[name="movie"]', { state: 'attached', timeout: 10 })

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
        await page.waitForTimeout(10)

        await page.waitForSelector('input[name="cinema"]', { timeout: 10 }).catch(() => null)
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
            await page.waitForTimeout(110)

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

    await browser.close()

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
        const message = await fetchShowtimes(date)
        res.json({ date, message })
    } catch (err: any) {
        res.status(500).json({ error: err.message })
    }
})

app.get('/kcc/siri', async (req, res) => {
    try {
        const date = getToday()
        const message = await fetchShowtimes(date)
        res.setHeader('Content-Type', 'text/plain')
        res.send(message)
    } catch (err: any) {
        res.status(500).send('Sorry, I could not get the showtimes right now.')
    }
})

app.listen(PORT, () => console.log(`🚀 KCC API running on port ${PORT}`))
