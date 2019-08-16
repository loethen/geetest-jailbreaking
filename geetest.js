const puppeteer = require('puppeteer-core');
const fs = require('fs');
const pixelmatch = require('pixelmatch');
const PNG = require('pngjs').PNG;

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        defaultViewport: {
            width: 1366,
            height: 768
        },
        headless: false
    });
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(()=>{
        Object.defineProperty(navigator, 'webDriver', {
            get: () => false
        })
    });

    await page.goto('https://zhiyou.smzdm.com/user/login/');

    await page.click('#login_submit',{delay:10});
    await page.waitFor(1000);
    await page.waitFor('.gt_slider_knob');
    await page.waitFor('.gt_cut_fullbg');

    const geetwrap = await page.$('.gt_cut_fullbg');
    const geetwrapBounding = await geetwrap.boundingBox();

    await page.screenshot({
        // fullPage: true,
        clip: geetwrapBounding,
        path: `origin.png`
    })

    const geetBtn = await page.$('.gt_slider_knob');
    const geetBtnBounding = await geetBtn.boundingBox();

    await page.mouse.move(geetBtnBounding.x + geetBtnBounding.width / 2, geetBtnBounding.y + geetBtnBounding.height / 2);
    await page.mouse.down();
    await page.mouse.move(geetBtnBounding.x + geetBtnBounding.width / 2 + 10, geetBtnBounding.y + geetBtnBounding.height / 2);
    await page.waitFor('.gt_slice.gt_show.gt_moving.gt_show');
    await page.evaluate(() => { document.querySelector('.gt_slice.gt_show.gt_moving').style.opacity = 0; });


    await page.screenshot({
        clip: geetwrapBounding,
        path: `clip.png`
    })

    await page.evaluate(() => { document.querySelector('.gt_slice.gt_show.gt_moving').style.opacity = 1; });
    const img1 = PNG.sync.read(fs.readFileSync('origin.png'));
    const img2 = PNG.sync.read(fs.readFileSync('clip.png'));
    const { width, height } = img1;
    const diff = new PNG({ width, height });

    let info = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.3 });

    await fs.writeFileSync('diff.png', PNG.sync.write(diff));

    let red;
    await fs.createReadStream('diff.png')
        .pipe(new PNG())
        .on('parsed', function () {
            var redPoints = [];
            for (var y = 0; y < this.height; y++) {
                for (var x = 0; x < this.width; x++) {
                    var idx = (this.width * y + x) << 2;
                    // invert color
                    if (this.data[idx] == 255 && this.data[idx + 1] == 0 && this.data[idx + 2] == 0) {
                        redPoints.push(x)
                        break;
                    }
                }

            }

            red = Math.min(...redPoints);
        });
    await page.waitFor(2000);
    console.log('需要滑动距离',red)
    for (let item of generator(red)) {
        console.log(item)
        await page.mouse.move(geetBtnBounding.x + geetBtnBounding.width / 2 + item - 7, geetBtnBounding.y + geetBtnBounding.height / 2,{steps:7});
    }
    await page.waitFor(500)
    page.mouse.up();
    
    
    await page.waitForNavigation();
    await page.click('.old-entry', { clickCount: 2});
    // console.log(page.url())
    
    // await browser.close();
    function* generator(distance) {
        // 匀减速运动
        let a = 12; //加速度
        let t = 5;  //分5步滑到位置
        let steps = 0;
        let slice_distance = [];
        let current_distance = 0;

        if(distance >= 116){
            a = 14; //远距离的时候加速度适当增加
        }

        v0 = Math.round((distance + 1 / 2 * a * t * t) / t);  //计算初始速度, 取整是为了留一定偏移量

        while (steps < t) {
            steps++;
            current_distance = v0 * steps - (1 / 2) * a * steps * steps;
            if(current_distance == distance ){
                continue;
            }
            slice_distance.push(current_distance);
        }
        slice_distance.push(distance);

        yield* slice_distance;

    }
})();
