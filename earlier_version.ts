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


// Nwest

// import express from 'express'
// import { chromium } from 'playwright'

// const app = express()
// const PORT = process.env.PORT || 3000

// function getToday(): string {
//     const today = new Date()
//     const dd = String(today.getDate()).padStart(2, '0')
//     const mm = String(today.getMonth() + 1).padStart(2, '0')
//     const yyyy = today.getFullYear()
//     return `${dd}-${mm}-${yyyy}`
// }

// const WAIT_SHORT = 1000
// const WAIT_MEDIUM = 1500
// const WAIT_LONG = 2000

// async function fetchShowtimes(formattedDate: string) {
//     const browser = await chromium.launch({ headless: true })
//     const page = await browser.newPage()

//     await page.goto('https://kccmultiplex.lk/buy-tickets/', { waitUntil: 'domcontentloaded' })

//     const dateSelector = `input[name="date"][value="${formattedDate}"]`
//     const labelSelector = `label[for="date-${formattedDate}"]`
//     try {
//         await page.waitForSelector(dateSelector, { state: 'attached', timeout: WAIT_MEDIUM })
//         const label = page.locator(labelSelector)
//         await label.scrollIntoViewIfNeeded()
//         await label.click({ force: true })
//     } catch {
//         await browser.close()
//         return { error: `Date ${formattedDate} not available` }
//     }

//     await page.getByRole('heading', { name: /select a movie/i }).waitFor({ timeout: WAIT_LONG })
//     await page.waitForSelector('input[name="movie"]', { state: 'attached', timeout: WAIT_MEDIUM })

//     const movies = await page.evaluate(() => {
//         const inputs = document.querySelectorAll<HTMLInputElement>('input[name="movie"]')
//         return Array.from(inputs).map((input) => ({
//             id: input.id,
//             title: document.querySelector(`label[for="${input.id}"]`)?.textContent?.trim(),
//         }))
//     })

//     const results: Record<string, any> = {}

//     for (const movie of movies) {
//         if (!movie.title) continue
//         const movieLabel = `label[for="${movie.id}"]`
//         await page.locator(movieLabel).click({ force: true })
//         await page.waitForTimeout(WAIT_SHORT)
//         await page.waitForSelector('input[name="cinema"]', { timeout: WAIT_SHORT }).catch(() => null)
//         const cinemas = await page.evaluate(() => {
//             const cinemaInputs = document.querySelectorAll<HTMLInputElement>('input[name="cinema"]')
//             return Array.from(cinemaInputs).map((cinema) => ({
//                 id: cinema.id,
//                 name: document.querySelector(`label[for="${cinema.id}"]`)?.textContent?.trim(),
//             }))
//         })

//         const cinemaResults: Record<string, string[]> = {}

//         for (const cinema of cinemas) {
//             if (!cinema.name) continue
//             const cinemaLabel = `label[for="${cinema.id}"]`
//             await page.locator(cinemaLabel).click({ force: true })
//             await page.waitForTimeout(WAIT_SHORT)
//             const showtimes = await page.evaluate(() => {
//                 const timeEls = document.querySelectorAll(
//                     '.showtimes button, [class*="showtime"] button, label[for^="showtime-"]'
//                 )
//                 return Array.from(timeEls)
//                     .map((el) => el.textContent?.trim())
//                     .filter(Boolean)
//             })
//             cinemaResults[cinema.name] = showtimes.length ? showtimes : ['No showtimes available']
//         }

//         results[movie.title] = cinemaResults
//     }

//     await browser.close()

//     let summary = `🎬 KCC Multiplex showtimes for ${formattedDate}:\n\n`
//     for (const [movie, cinemas] of Object.entries(results)) {
//         summary += `🎞️ ${movie}\n`
//         for (const [cinema, times] of Object.entries(cinemas)) {
//             summary += `  🍿 ${cinema}: ${(times as string[]).join(', ')}\n`
//         }
//         summary += '\n'
//     }

//     return summary.trim()
// }

// app.get('/kcc', async (req, res) => {
//     try {
//         const date = getToday()
//         const message = await fetchShowtimes(date)
//         res.json({ date, message })
//     } catch (err: any) {
//         res.status(500).json({ error: err.message })
//     }
// })

// app.get('/kcc/siri', async (req, res) => {
//     try {
//         const date = getToday()
//         const message = await fetchShowtimes(date)
//         res.setHeader('Content-Type', 'text/plain')
//         res.send(message)
//     } catch (err: any) {
//         res.status(500).send('Sorry, I could not get the showtimes right now.')
//     }
// })

// app.listen(PORT, () => console.log(`🚀 KCC API running on port ${PORT}`))

