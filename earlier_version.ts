import express from 'express'
import { chromium } from 'playwright'

const app = express()
const PORT = process.env.PORT || 3000

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

    const hasSelectDate = await page
        .getByRole('heading', { name: /select a date/i })
        .isVisible()
        .catch(() => false)

    if (!hasSelectDate) {
        await browser.close()
        return {}
    }

    const dateSelector = `input[name="date"][value="${formattedDate}"]`
    const labelSelector = `label[for="date-${formattedDate}"]`

    try {
        await page.waitForSelector(dateSelector, { state: 'attached', timeout: 15000 })
        const isRadio = await page.evaluate((selector) => {
            const el = document.querySelector<HTMLInputElement>(selector)
            return el?.type === 'radio'
        }, dateSelector)

        if (isRadio) {
            await page.waitForSelector(labelSelector, { state: 'visible', timeout: 15000 })
            const label = page.locator(labelSelector)
            await label.scrollIntoViewIfNeeded()
            await label.click({ force: true })
        }
    } catch (err) {
        await browser.close()
        return {}
    }

    await page.getByRole('heading', { name: /select a movie/i }).waitFor({ timeout: 30000 })
    await page.waitForSelector('input[name="movie"]', { state: 'attached', timeout: 30000 })


    // Extract only movie titles only for now will conduct an enhancement.
    const movieNames = await page.evaluate(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>('input[name="movie"]')
        return Array.from(inputs)
            .map((input) =>
                document.querySelector(`label[for="${input.id}"]`)?.textContent?.trim()
            )
            .filter(Boolean)
    })

    await browser.close()

    // Build a nice readable message
    const list =
        movieNames.length === 1
            ? movieNames[0]
            : movieNames.slice(0, -1).join(', ') + ' and ' + movieNames.slice(-1)

    return `🎬 KCC Multiplex is showing ${list} on ${formattedDate}.`
}

// ✅ JSON endpoint
app.get('/kcc', async (req, res) => {
    try {
        const date = "09-11-2025"
        const movies = await fetchShowtimes(date)
        res.json(movies)
    } catch (err: any) {
        res.status(500).json({ error: err.message })
    }
})

// 🗣️ Siri endpoint
app.get('/kcc/siri', async (req, res) => {
    try {
        const date = "09-11-2025"
        const movies = await fetchShowtimes(date)
        res.json(movies)
    } catch (err: any) {
        res.status(500).json({ error: err.message })
    }
})

app.listen(PORT, () => console.log(`🚀 KCC API running on port ${PORT}`))
