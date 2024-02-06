const robot = require('robotjs');
const screenshot = require('screenshot-desktop');
const Tesseract = require('tesseract.js');
const Jimp = require('jimp');
const fs = require('fs').promises;

let globalDataArray = []; 
let logFunction = null;

async function startProcessing(loggingFunction) {
    try{
        logFunction = loggingFunction;
        console.log("Waiting 5 seconds before starting...");
        logFunction("Waiting 5 seconds before starting...");
        await new Promise(resolve => setTimeout(resolve, 5000)); 
        console.log("Starting processing...");

        let continueProcessing = true;
        while (continueProcessing) {
            const screenshotData = await collectScreenshotData(config);
            const processedData = await processScreenshots(screenshotData);
            console.log(2);
            const hasInvalidData = processedData.some(({ texts }) => 
                texts.length === 0 || !isValidName(texts[0])
            );

            if (!hasInvalidData) {
                const validData = processedData.filter(({ texts }) => isValidName(texts[0]));
                globalDataArray = [...globalDataArray, ...convertDataToMonsArray(validData)];
                console.log("Cycle complete. Pressing the 'E' key and restarting...");
                logFunction("Cycle complete. Pressing the 'E' key and restarting...");
                robot.keyTap("e"); // Simulate pressing the "E" key
                await new Promise(resolve => setTimeout(resolve, 500)); // Wait a bit before next cycle
            } else {
                const validData = processedData.filter(({ texts }) => isValidName(texts[0]));
                globalDataArray = [...globalDataArray, ...convertDataToMonsArray(validData)];
                console.log("Invalid data detected within the cycle, stopping processing.");
                logFunction("Invalid data detected within the cycle, stopping processing.");
                continueProcessing = false;
            }
        }

        if (globalDataArray.length > 0) {
          return globalDataArray;
            console.log("Processing complete. Final valid data array saved.");
            logFunction("Processing complete. Final valid data array saved.");
        } else {
            console.log("No valid data collected. No file saved.");
            logFunction("No valid data collected. No file saved.");
        }
    } catch (error){
        logFunction(`Error: ${error.message}`)
    }
}

async function collectScreenshotData(config) {
    try {
        let screenshotData = [];
        for (let y = 0; y <= config.verticalMoves; y++) {
            for (let x = 0; x <= config.horizontalMoves; x++) {
                const currentPosition = {
                    x: config.startPoint.x + x * config.horizontalDistance,
                    y: config.startPoint.y + y * config.verticalDistance,
                };

                robot.moveMouse(currentPosition.x, currentPosition.y);
                await new Promise(resolve => setTimeout(resolve, 25)); 

                const imgBuffer = await screenshot({ format: 'png' });

                const image = await Jimp.read(imgBuffer);

                const textImage = await preprocessImageForOCR(image.clone());

                const genderImage = image.clone();

                screenshotData.push({
                    genderImage, 
                    textImage,
                    areas: config.textAreas.map(area => ({ ...area })),
                    position: currentPosition,
                });
            }
        }
        return screenshotData;
    } catch (error) {
        logFunction(`Error in collectScreenshotData: ${error.message}`);
    }
}

async function preprocessImageForOCR(image) {
    try {
        const processedImage = image.greyscale().contrast(0.5).normalize().blur(1);
        return processedImage;
    } catch (error) {
        logFunction(`Error: ${error.message}`)
        throw error; 
    }
}

async function detectGenderBeforeProcessing(image, { x, y, width, height }, boyColor, girlColor) {
    try{
        let boyDetected = false;
        let girlDetected = false;
        image.scan(x, y, width, height, function(x, y, idx) {
            const red = this.bitmap.data[idx];
            const green = this.bitmap.data[idx + 1];
            const blue = this.bitmap.data[idx + 2];
            if (red === boyColor.r && green === boyColor.g && blue === boyColor.b) boyDetected = true;
            if (red === girlColor.r && green === girlColor.g && blue === girlColor.b) girlDetected = true;
        });

        if (boyDetected) return 'Boy';
        else if (girlDetected) return 'Girl';
        else return 'Unknown';
    } catch(error) {
        logFunction(`Error: ${error.message}`)
    }
}

async function extractTextFromCompositeImage(image, areas) {
    const totalHeight = areas.reduce((acc, area) => acc + area.height + 10, 0); 
    const maxWidth = Math.max(...areas.map(area => area.width));


    const compositeImage = new Jimp(maxWidth, totalHeight, 0x00000000);

    let currentY = 0;
    for (const { x, y, width, height } of areas) {
        const cropped = image.clone().crop(x, y, width, height);
        await compositeImage.blit(cropped, 0, currentY);
        currentY += height + 10; 
    }

    const buffer = await compositeImage.getBufferAsync(Jimp.MIME_PNG);

    
    const { data: { text } } = await Tesseract.recognize(buffer, 'eng', {
        logger: m => console.log(m),
        tessedit_pageseg_mode: 6,
    });

    
    let texts = text.trim().split('\n').map(line => 
        line.trim().replace(/[^a-zA-Z\s]/g, '') 
    );

    
    while (texts.length < 5) {
        texts.push('');
    }

    return texts;
}

async function saveMonsArrayToFile(MonsArray, filename) {
    try{
        await fs.writeFile(filename, JSON.stringify(MonsArray, null, 2), 'utf8');
        console.log(`MonsArray has been saved to ${filename}`);
    } catch(error) {
        logFunction(`Error: ${error.message}`)
    }
}

async function processScreenshots(screenshotData, ) {
    try {
        let batchSize = 30;
        const processedData = [];

        async function processBatch(batch) {
            return await Promise.all(batch.map(async ({ genderImage, textImage, areas, position }) => {
                const gender = await detectGenderBeforeProcessing(genderImage, config.genderArea, config.boyColor, config.girlColor);
                const texts = await extractTextFromCompositeImage(textImage, areas);
                return { position, gender, texts };
            }));
        }

        for (let i = 0; i < screenshotData.length; i += batchSize) {
            const batch = screenshotData.slice(i, i + batchSize);
            const batchResults = await processBatch(batch);
            processedData.push(...batchResults); 
        }

        console.log(processedData);
        return processedData;
    } catch (error) {
        logFunction(`Error: ${error.message}`);
    }
}

function isValidText(text) {
    try{
        const validPattern = /^[a-zA-Z0-9\s,.'-]{3,}$/;
        return validPattern.test(text);
    } catch(error) {
        logFunction(`Error: ${error.message}`)
    }
}

function isValidName(text) {
    try{
        
        return text.trim() !== '' && !text.includes('Unknown');
    } catch(error) {
        logFunction(`Error: ${error.message}`)
    }
}

function convertDataToMonsArray(globalDataArray) {
    try{
        return globalDataArray.map(({ texts, gender }) => ({
            name: texts[0] || 'Unknown', 
            passives: texts.slice(1), 
            gender: gender || 'Unknown',
        }));
    } catch(error) {
        logFunction(`Error: ${error.message}`)
    }
}

let config = {
    startPoint: { x: 700, y: 260 },
    horizontalMoves: 5,
    verticalMoves: 4,
    horizontalDistance: 78,
    verticalDistance: 78,
    textAreas: [
        { x: 1325, y: 150, width: 260, height: 50 },
        { x: 1250, y: 850, width: 177, height: 35 },
        { x: 1250, y: 883, width: 177, height: 35 },
        { x: 1470, y: 850, width: 177, height: 35 },
        { x: 1470, y: 883, width: 177, height: 35 }
    ],
    genderArea: { x: 1640, y: 150, width: 50, height: 50 },
    boyColor: { r: 77, g: 201, b: 255 },
    girlColor: { r: 255, g: 77, b: 106 }
};

module.exports = { startProcessing };