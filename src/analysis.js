/**
 * [TODO] Step 0: Import the dependencies, fs and papaparse
 */

const fs = require('fs');
const Papa = require('papaparse');

/**
 * [TODO] Step 1: Parse the Data
 *      Parse the data contained in a given file into a JavaScript objectusing the modules fs and papaparse.
 *      According to Kaggle, there should be 2514 reviews.
 * @param {string} filename - path to the csv file to be parsed
 * @returns {Object} - The parsed csv file of app reviews from papaparse.
 */
function parseData(filename) {
    if (!filename) {
        throw new Error('parseData(filename) is required');
    }

    let csvText;
    try {
        csvText = fs.readFileSync(filename, 'utf8');
    } catch {
        csvText = fs.readFileSync(`src/${filename}`, 'utf8');
    }

    const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        delimitersToGuess: [',', ';', '\t', '|'],
    });

    const { errors, data: raw, meta } = parsed;

    if (errors && errors.length) {
        const { length: errorCount } = errors;
        const firstError = errors[0];
        console.warn(
            `PapaParse reported ${errorCount} error(s). First:`,
            firstError,
        );
    }

    const data = raw.filter((row) => row && Object.keys(row).length > 0);
    return { data, errors, meta };
}

/**
 * [TODO] Step 2: Clean the Data
 *      Filter out every data record with null column values, ignore null gender values.
 *
 *      Merge all the user statistics, including user_id, user_age, user_country, and user_gender,
 *          into an object that holds them called "user", while removing the original properties.
 *
 *      Convert review_id, user_id, num_helpful_votes, and user_age to Integer
 *
 *      Convert rating to Float
 *
 *      Convert review_date to Date
 * @param {Object} csv - a parsed csv file of app reviews
 * @returns {Object} - a cleaned csv file with proper data types and removed null values
 */
function cleanData(csv) {
    const rows = Array.isArray(csv)
        ? csv
        : csv && Array.isArray(csv.data)
          ? csv.data
          : [];

    return rows
        .filter((row) => {
            for (const [key, val] of Object.entries(row)) {
                if (key === 'user_gender') continue;
                const s = String(val ?? '').trim();
                if (s === '' || s.toLowerCase() === 'null') return false;
            }
            return true;
        })
        .map(
            ({
                review_id,
                app_name,
                app_category,
                review_text,
                review_language,
                rating,
                review_date,
                verified_purchase,
                device_type,
                num_helpful_votes,
                app_version,
                user_id,
                user_age,
                user_country,
                user_gender,
            }) => ({
                review_id: parseInt(review_id, 10),
                app_name,
                app_category,
                review_text,
                review_language,
                rating: parseFloat(rating),
                review_date: new Date(review_date),
                verified_purchase:
                    String(verified_purchase).toLowerCase() === 'true',
                device_type,
                num_helpful_votes: parseInt(num_helpful_votes, 10),
                app_version,
                user: {
                    user_id: parseInt(user_id, 10),
                    user_age: parseInt(user_age, 10),
                    user_country,
                    user_gender: user_gender || '',
                },
            }),
        );
}

/**
 * [TODO] Step 3: Sentiment Analysis
 *      Write a function, labelSentiment, that takes in a rating as an argument
 *      and outputs 'positive' if rating is greater than 4, 'negative' is rating is below 2,
 *      and 'neutral' if it is between 2 and 4.
 * @param {Object} review - Review object
 * @param {number} review.rating - the numerical rating to evaluate
 * @returns {string} - 'positive' if rating is greater than 4, negative is rating is below 2,
 *                      and neutral if it is between 2 and 4.
 */
function labelSentiment({ rating }) {
    if (rating > 4.0) return 'positive';
    if (rating < 2.0) return 'negative';
    return 'neutral';
}

/**
 * [TODO] Step 3: Sentiment Analysis by App
 *      Using the previous labelSentiment, label the sentiments of the cleaned data
 *      in a new property called "sentiment".
 *      Add objects containing the sentiments for each app into an array.
 * @param {Object} cleaned - the cleaned csv data
 * @returns {{app_name: string, positive: number, neutral: number, negative: number}[]} - An array of objects, each summarizing sentiment counts for an app
 */
function sentimentAnalysisApp(cleaned) {
    const counts = new Map();

    for (const review of cleaned) {
        const app = review.app_name;
        const label = labelSentiment({ rating: review.rating });

        review.sentiment = label;

        if (!counts.has(app)) {
            counts.set(app, { positive: 0, neutral: 0, negative: 0 });
        }
        counts.get(app)[label] += 1;
    }

    return Array.from(counts.entries()).map(
        ([app_name, { positive, neutral, negative }]) => ({
            app_name,
            positive,
            neutral,
            negative,
        }),
    );
}

/**
 * [TODO] Step 3: Sentiment Analysis by Language
 *      Using the previous labelSentiment, label the sentiments of the cleaned data
 *      in a new property called "sentiment".
 *      Add objects containing the sentiments for each language into an array.
 * @param {Object} cleaned - the cleaned csv data
 * @returns {{lang_name: string, positive: number, neutral: number, negative: number}[]} - An array of objects, each summarizing sentiment counts for a language
 */
function sentimentAnalysisLang(cleaned) {
    const counts = new Map();

    for (const review of cleaned) {
        const lang = review.review_language;
        const label =
            review.sentiment ?? labelSentiment({ rating: review.rating });
        review.sentiment = label;

        if (!counts.has(lang)) {
            counts.set(lang, { positive: 0, neutral: 0, negative: 0 });
        }
        counts.get(lang)[label] += 1;
    }

    return Array.from(counts.entries()).map(
        ([lang_name, { positive, neutral, negative }]) => ({
            lang_name,
            positive,
            neutral,
            negative,
        }),
    );
}

/**
 * [TODO] Step 4: Statistical Analysis
 *      Answer the following questions:
 *
 *      What is the most reviewed app in this dataset, and how many reviews does it have?
 *
 *      For the most reviewed app, what is the most commonly used device?
 *
 *      For the most reviewed app, what the average star rating (out of 5.0)?
 *
 *      Add the answers to a returned object, with the format specified below.
 * @param {Object} cleaned - the cleaned csv data
 * @returns {{mostReviewedApp: string, mostReviews: number, mostUsedDevice: String, mostDevices: number, avgRating: float}} -
 *          the object containing the answers to the desired summary statistics, in this specific format.
 */
function summaryStatistics(cleaned) {
    if (!Array.isArray(cleaned) || cleaned.length === 0) {
        return {
            mostReviewedApp: '',
            mostReviews: 0,
            mostUsedDevice: '',
            mostDevices: 0,
            avgRating: 0,
        };
    }

    const appStats = new Map();

    for (const r of cleaned) {
        const app = r.app_name;
        if (!appStats.has(app)) {
            appStats.set(app, {
                count: 0,
                ratingSum: 0,
                deviceCounts: new Map(),
            });
        }
        const stat = appStats.get(app);
        stat.count += 1;
        stat.ratingSum += r.rating;

        const d = r.device_type;
        stat.deviceCounts.set(d, (stat.deviceCounts.get(d) || 0) + 1);
    }

    let mostReviewedApp = '';
    let mostReviews = -1;
    for (const [app, stat] of appStats.entries()) {
        if (stat.count > mostReviews) {
            mostReviews = stat.count;
            mostReviewedApp = app;
        }
    }

    const top = appStats.get(mostReviewedApp);
    let mostUsedDevice = '';
    let mostDevices = -1;
    for (const [device, cnt] of top.deviceCounts.entries()) {
        if (cnt > mostDevices) {
            mostDevices = cnt;
            mostUsedDevice = device;
        }
    }

    const avgRating = top.ratingSum / top.count;

    return {
        mostReviewedApp,
        mostReviews,
        mostUsedDevice,
        mostDevices,
        avgRating,
    };
}

/**
 * Do NOT modify this section!
 */
module.exports = {
    parseData,
    cleanData,
    sentimentAnalysisApp,
    sentimentAnalysisLang,
    summaryStatistics,
    labelSentiment,
};
