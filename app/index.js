const axios = require('axios')
const mongoose = require('mongoose')
const cheerio = require('cheerio')
const housecall = require('housecall')
const Products = require('./models/product')
let date = new Date()
let dateFormat = `${date.getFullYear()}-${date.getDay()}-${date.getMonth() + 1} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`
let queue = housecall({
    concurrency: 3,
    cooldown: 2000
})

mongoose.connect(`mongodb://127.0.0.1:27017/43einhalb`, {
    useNewUrlParser: true,
    useCreateIndex: true
})
mongoose.Promise = global.Promise;

var webHookURLs = [
    'https://discordapp.com/api/webhooks/593547499407540292/MhECH6BnkcsR8Dn5_DMnBJRTpYeq_3sS9NpJJmfyPA61SeJGp6k6g8fj-CAue9j8JfU4'
]

async function sendDicordWebhook(embedData) {
    for (url in webHookURLs) {
        queue.push(() => {
            axios.post(webHookURLs[url], embedData)
        })
        //console.log('Message sent!')
    }
}

startmonitor()

function startmonitor() {
    setTimeout(async function () {
        axios.get('https://www.43einhalb.com/en/sneaker/page/1/sort/date_new/perpage/36')
            .then(data => {
                $ = cheerio.load(data.data, {
                    xmlMode: true
                })
                let i = 0;
                $('.pInfo').each((i, elem) => {
                    let productID = $('.block-grid.three-up.mobile-two-up.productListing').children('li').eq(i).attr('class').split('-');
                    productID = productID[productID.length - 1].split(' ')
                    productID = productID[0]
                    let productTitle = $(elem).find('.pName').children('.productName').text();
                    let productPrice = $(elem).find('.pPrice').text().replace(/\s/g, '');
                    let productImage = $('.pImages').eq(i).children('div').children('div').eq(0).attr('data-src');
                    let productLink = 'https://www.43einhalb.com' + $('.pQuickView').eq(i).children('a').attr('href');
                    let productVariants = [];
                    $(elem).find('.availableVariants').children('li').each((i, e) => {
                        let isSoldOut = $(e).attr('title');
                        if (isSoldOut === "") {
                            productVariants.push($(e).children('a').text());
                        }
                    })
                    // console.log(productID)
                    // console.log(productTitle)
                    // console.log(productLink)
                    // console.log(productPrice)
                    //console.log(productImage)
                    // console.log(productVariants)
                    Products.findOne({
                        productID: productID
                    }).then((found) => {
                        if (found === null) {
                            try {
                                sendDicordWebhook({
                                    embeds: [{
                                        "color": 0xa350f9,
                                        "title": `${productTitle} - New Product`,
                                        "url": productLink,
                                        "thumbnail": {
                                            "url": 'https://www.43einhalb.com/files/image/id/200478/w/350/h/210/n/nike-woman-618919-030-benassi-jdi-print-1.jpg' //productImage
                                        },
                                        "fields": [{
                                                "name": `Price:`,
                                                "value": productPrice,
                                                "inline": true
                                            },
                                            {
                                                "name": `Sizes`,
                                                "value": productVariants.join(' ')
                                            }
                                        ],
                                        "footer": {
                                            "icon_url": 'https://pbs.twimg.com/profile_images/1137456856102789120/mAGLqFyF_400x400.png',
                                            "text": `Powered By: Kex Software | ${dateFormat}`
                                        }
                                    }]
                                })
                                new Products({
                                    _id: new mongoose.Types.ObjectId(),
                                    productID: productID,
                                    productVariants: productVariants
                                }).save()
                            } catch (err) {
                                console.log(err)
                            }
                        } else {
                            if (productVariants.filter(e => !found.productVariants.includes(e)).length != 0) {
                                console.log("Restock!")
                                sendDicordWebhook({
                                    embeds: [{
                                        color: 0xa350f9,
                                        title: `${productTitle} - Restocked`,
                                        url: productLink,
                                        thumbnail: {
                                            url: productImage
                                        },
                                        fields: [{
                                                name: `Price:`,
                                                value: productPrice,
                                                inline: true
                                            },
                                            {
                                                name: `Sizes`,
                                                value: productVariants.join(' ')
                                            }
                                        ],
                                        footer: {
                                            icon_url: 'https://pbs.twimg.com/profile_images/1137456856102789120/mAGLqFyF_400x400.png',
                                            text: `Powered By: Kex Software | ${dateFormat}`
                                        }
                                    }]
                                })
                                Products.findOneAndUpdate({
                                    productID: productID
                                }, {
                                    productVariants: productVariants
                                })
                            } else if (found.productVariants.filter(e => !productVariants.includes(e)).length != 0) {
                                Products.findOneAndUpdate({
                                    productID: productID
                                }, {
                                    productSizes: productSizes
                                })
                            }
                        }
                    })
                })
                startmonitor()
            }).catch(err => {
                console.log(err)
            })
    }, 1000)
}