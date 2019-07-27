const esri = require("./esri");
const zipCodes = require("./zipcodes");
const Sequelize = require("sequelize");
const moment = require("moment");

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "db/data.db",
  logging: false
});

(async () => {
  console.log(`${new Date()} begin`);
  console.log(`total of ${zipCodes.length} zip codes to process`);

  for (let index in zipCodes) {
    let zipCode = zipCodes[index],
      createdOnDate = moment().format("YYYY-MM-DD");
    console.log(
      `${moment().format()} [${parseInt(index) + 1}/${
        zipCodes.length
      }] processing ${zipCode}`
    );

    var isExists = await sequelize.query(
      "SELECT 1 FROM  `ZipCode` where ZipCode = :zipCode AND CreatedOnDate = :createdOnDate",
      {
        replacements: { zipCode, createdOnDate },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (isExists.length > 0) continue;
    try {
      let result = await esri(zipCode);
      if (result) {
        await sequelize.query(
          `INSERT INTO ZipCode SELECT :zipCode, :stats, :createdOnDate, :createdOnTime
        WHERE NOT EXISTS (select 1 from ZipCode where ZipCode = :zipCode AND CreatedOnDate = :createdOnDate)`,
          {
            replacements: {
              zipCode: result.zipCode,
              stats: JSON.stringify(result),
              createdOnDate,
              createdOnTime: moment().format("HH:mm ZZ")
            },
            type: sequelize.QueryTypes.INSERT
          }
        );
      }
    } catch (err) {
      console.log(err);
      console.log('moving on..');
    }
  }

  console.log(`${new Date()} end`);
})();
