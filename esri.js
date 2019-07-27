const puppeteer = require("puppeteer"),
  cheerio = require("cheerio");

const topics = [
  "Median Income",
  "Population Density",
  "Median Age",
  "Monthly Credit Card Charges",
  "Financial Optimists",
  "Online Banking Users",
  "Graduate and Professional Degrees",
  "Manufacturing Workforce",
  "College Football Viewers"
];

String.prototype.replaceAll = function(search, replacement) {
  let target = this;
  return target.split(search).join(replacement);
};

const getTapestry = $ => {
  let tapestryTableClassName = "tapestries",
    tapestries = [];

  $(`.${tapestryTableClassName} > tbody > tr`).each((rowIndex, row) => {
    var cellPercent = $(row).find("td.tapestry-percent");
    var cellName = $(row).find("td.tapestry-name");
    var percent = cellPercent.text();
    var name = cellName.text();

    tapestries.push({ name, percent });
  });

  return tapestries;
};

const getTopicStatistics = ($, topicTitle) => {
  let topic;
  $(".main-graph-panel").each((indexPanel, panel) => {
    let topicFound =
      $(panel)
        .find(".graph-panel-title > span")
        .text()
        .trim() == topicTitle;

    if (!topicFound) return true;

    let zip = getBarGraph($, panel, "ZIP"),
      county = getBarGraph($, panel, "County"),
      state = getBarGraph($, panel, "State"),
      us = getBarGraph($, panel, "US");

    topic = { topic: topicTitle, zip, county, state, us };

    return false;
  });

  return topic;
};

const getBarGraph = ($, panel, labelName) =>
  $(panel)
    .find(`bar-graph[label="${labelName}"]`)
    .attr("value");

const getStatistics = async (page, zipCode, batch) => {
  let esriUrl = `https://webapps-cdn.esri.com/Apps/location-strategy-for-business/#/insights?zip=${zipCode}&graphs=${batch}`;

  await page.goto(esriUrl, { waitUntil: "networkidle2" });

  await page.waitFor(1250);

  var hasError = await page.evaluate(
    () => document.querySelectorAll(".input-error-message.is-active").length
  );
  if (hasError > 0) {
    await page.close();
    return null;
  }

  await page.waitFor(() => !document.querySelector(".is-active"), {
    timeout: 60000
  }); //wait until loaders are gone.

  const html = await page.evaluate(() => document.body.innerHTML);

  const $ = cheerio.load(html);

  let tapestries = getTapestry($),
    topicsInBatch = batch.replaceAll("-", " ").split(",");

  let topicsStatistics = [];
  topics.forEach(topic => {
    if (topicsInBatch.includes(topic))
      topicsStatistics.push(getTopicStatistics($, topic));
  });

  await page.close();

  return { tapestries, topicsStatistics };
};

const search = async zipCode => {
  let zipCodeStatistics = [],
    batches = [
      "Median-Income,Population-Density,Median-Age",
      "Monthly-Credit-Card-Charges,Online-Banking-Users",
      "Financial-Optimists,Graduate-and-Professional-Degrees",
      "Manufacturing-Workforce,College-Football-Viewers"
    ];

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1278, height: 927 }
  });

  let values = await Promise.all([
    getStatistics(await browser.newPage({}), zipCode, batches[0]),
    getStatistics(await browser.newPage({}), zipCode, batches[1]),
    getStatistics(await browser.newPage({}), zipCode, batches[2]),
    getStatistics(await browser.newPage({}), zipCode, batches[3])
  ]);

  values.forEach(e => {
    if (e) zipCodeStatistics.push(e);
  });

  await browser.close();

  if (zipCodeStatistics.length > 0) {
    let statistics = zipCodeStatistics
      .map(stat => stat.topicsStatistics)
      .reduce((a, b) => a.concat(b));

    return { zipCode, tapestries: zipCodeStatistics[0].tapestries, statistics };
  }
  return null;
};

module.exports = search;
