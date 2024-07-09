const { chromium } = require('playwright');
const XLSX = require('xlsx');

(async () => {
    const nameSheet = 'uốn tóc1 phường 1.xlsx';
    const googleUrl = 'https://www.google.com/maps/search/u%E1%BB%91n+t%C3%B3c+ph%C6%B0%E1%BB%9Dng+1+t%C3%A2n+b%C3%ACnh/@10.8033498,106.6409201,15z/data=!3m1!4b1?entry=ttu';

    console.time("Execution Time");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Navigate to Google Maps search page
    await page.goto(googleUrl);
    await page.waitForSelector('[jstcache="3"]');

    // Scroll through the list to load all results
    const scrollable = await page.$('xpath=/html/body/div[2]/div[3]/div[8]/div[9]/div/div/div[1]/div[2]/div/div[1]/div/div/div[1]/div[1]');
    if (!scrollable) {
        console.log('Scrollable element not found.');
        await browser.close();
        return;
    }

    let endOfList = false;
    while (!endOfList) {
        await scrollable.evaluate(node => node.scrollBy(0, 50000));
        endOfList = await page.evaluate(() => document.body.innerText.includes("You've reached the end of the list"));
    }

    // Extract URLs
    const urls = await page.$$eval('a', links => links.map(link => link.href).filter(href => href.startsWith('https://www.google.com/maps/place/')));

    const scrapePageData = async (url) => {
        const newPage = await browser.newPage();
        await newPage.goto(url);
        await newPage.waitForSelector('[jstcache="3"]');

        // Scrape required details
        const nameElement = await newPage.$('xpath=/html/body/div[2]/div[3]/div[8]/div[9]/div/div/div[1]/div[2]/div/div[1]/div/div/div[2]/div/div[1]/div[1]/h1');
        let name = nameElement ? await newPage.evaluate(element => element.textContent, nameElement) : '';

        const ratingElement = await newPage.$('xpath=/html/body/div[2]/div[3]/div[8]/div[9]/div/div/div[1]/div[2]/div/div[1]/div/div/div[2]/div/div[1]/div[2]/div/div[1]/div[2]/span[1]/span[1]');
        let rating = ratingElement ? await newPage.evaluate(element => element.textContent, ratingElement) : '';

        const reviewsElement = await newPage.$('xpath=/html/body/div[2]/div[3]/div[8]/div[9]/div/div/div[1]/div[2]/div/div[1]/div/div/div[2]/div/div[1]/div[2]/div/div[1]/div[2]/span[2]/span/span');
        let reviews = reviewsElement ? await newPage.evaluate(element => element.textContent, reviewsElement) : '';
        reviews = reviews.replace(/\(|\)/g, '');

        const categoryElement = await newPage.$('xpath=/html/body/div[2]/div[3]/div[8]/div[9]/div/div/div[1]/div[2]/div/div[1]/div/div/div[2]/div/div[1]/div[2]/div/div[2]/span/span/button');
        let category = categoryElement ? await newPage.evaluate(element => element.textContent, categoryElement) : '';

        const addressElement = await newPage.$('button[data-tooltip="Copy address"]');
        let address = addressElement ? await newPage.evaluate(element => element.textContent, addressElement) : '';

        const websiteElement = await newPage.$('a[data-tooltip="Open website"]') || await newPage.$('a[data-tooltip="Open menu link"]');
        let website = websiteElement ? await newPage.evaluate(element => element.getAttribute('href'), websiteElement) : '';

        const phoneElement = await newPage.$('button[data-tooltip="Copy phone number"]');
        let phone = phoneElement ? await newPage.evaluate(element => element.textContent, phoneElement) : '';

        await newPage.close();
        return { name, rating, reviews, category, address, website, phone, url };
    };

    // Batch processing
    const batchSize = 5; // Adjust batch size based on your system capability
    const results = [];

    for (let i = 0; i < urls.length; i += batchSize) {
        const batchUrls = urls.slice(i, i + batchSize);
        const batchResults = await Promise.all(batchUrls.map(url => scrapePageData(url)));
        results.push(...batchResults);
        console.log(`Batch ${i / batchSize + 1} completed.`);
    }

    // Convert results to XLSX format and write to file
    const worksheet = XLSX.utils.json_to_sheet(results);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');
    XLSX.writeFile(workbook, nameSheet);

    await browser.close();
    console.timeEnd("Execution Time");
})();
