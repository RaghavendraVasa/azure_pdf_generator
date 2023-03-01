import * as common from './common';
import * as nodeApi from 'azure-devops-node-api';
import * as TestApi from 'azure-devops-node-api/TestApi';
import * as TestInterfaces from 'azure-devops-node-api/interfaces/TestInterfaces';
import { PDFDocument, PDFPage, PageSizes, PDFImage } from 'pdf-lib'
import fs from 'fs'
import * as StreamPromises from "stream/promises";
const doc = PDFDocument.create()

async function run() {
    const projectId: string = common.getProject();
    const webApi: nodeApi.WebApi = await common.getWebApi();
    const testApiObject: TestApi.ITestApi = await webApi.getTestApi();
    const runs: TestInterfaces.TestRun[] = await testApiObject.getTestRuns(projectId);
    const testResultsByRunId = await testApiObject.getTestResults(projectId, runs[runs.length - 1].id)

    if (!fs.existsSync('./screenshots')) {
        fs.mkdirSync('./screenshots', { recursive: true })
    }

    const doc = await PDFDocument.create()
    let page: PDFPage

    await Promise.all(testResultsByRunId.map(async (testResult) => {
        const attachments: TestInterfaces.TestAttachment[] = await testApiObject.getTestResultAttachments(projectId, runs[runs.length - 1].id, testResult.id as number)
        await Promise.all(attachments.map(async (attachment) => {
            if (attachment.fileName?.startsWith('Before')) {
                page = doc.addPage([PageSizes.A4[1], PageSizes.A4[0]])
            }
            if (attachment.fileName?.endsWith('.png')) {
                let readableStream: NodeJS.ReadableStream = await testApiObject.getTestResultAttachmentContent(projectId, runs[runs.length - 1].id, testResult.id as number, attachment.id)
                let writableStream = fs.createWriteStream(`./screenshots/${attachment.fileName}`)
                await StreamPromises.pipeline(readableStream, writableStream);
                let image = await doc.embedPng(fs.readFileSync(`./screenshots/${attachment.fileName}`))
                const pngDims = image.scale(0.2)
                if (attachment.fileName?.startsWith('Before')) {
                    page.drawImage(image, {
                        x: 20,
                        y: page.getHeight() / 2,
                        width: pngDims.width,
                        height: pngDims.height,
                    })
                } else {
                    page.drawImage(image, {
                        x: page.getWidth() / 2 + 10,
                        y: page.getHeight() / 2,
                        width: pngDims.width,
                        height: pngDims.height,
                    })
                }
            }
        }))
    }))
    fs.writeFileSync('./output.pdf', await doc.save())
}

async function pdf() {
    const projectId: string = common.getProject();
    const webApi: nodeApi.WebApi = await common.getWebApi();
    const testApiObject: TestApi.ITestApi = await webApi.getTestApi();
    const runs: TestInterfaces.TestRun[] = await testApiObject.getTestRuns(projectId);
    const testResultsByRunId: TestInterfaces.TestCaseResult[] = await testApiObject.getTestResults(projectId, runs[runs.length - 1].id)

    if (!fs.existsSync('./screenshots')) {
        fs.mkdirSync('./screenshots', { recursive: true })
    }

    await Promise.all(testResultsByRunId.map(async (testResult) => {
        const attachments: TestInterfaces.TestAttachment[] = await testApiObject.getTestResultAttachments(projectId, runs[runs.length - 1].id, testResult.id as number)
        let filtered_attachments = attachments.filter(function (attachment) {
            if (attachment.fileName?.endsWith('.png')) {
                return attachment;
            }
        })
        //let sortedAttachments = attachments.sort((p1, p2) => (p1.id > p2.id) ? 1 : (p1.id < p2.id) ? -1 : 0)
        await Promise.all(filtered_attachments.map(async (attachment) => {
            let readableStream: NodeJS.ReadableStream = await testApiObject.getTestResultAttachmentContent(projectId, runs[runs.length - 1].id, testResult.id as number, attachment.id)
            let writableStream = fs.createWriteStream(`./screenshots/${attachment.fileName}`)
            await StreamPromises.pipeline(readableStream, writableStream);
        }))
        let dividedArray= sliceIntoChunks(filtered_attachments,2)
        for(let i=0; i< dividedArray.length; i++){
            createPage(testResult.testCaseTitle as string, dividedArray[i][0].fileName as string, dividedArray[i][1].fileName as string,dividedArray[i][0].fileName as string,dividedArray[i][1].fileName as string)
        }
    }))
    fs.writeFileSync('./output.pdf', await (await doc).save())
}

async function createPage(testCase: string, beforeStep: string, afterStep: string, beforeImg: string, afterImg: string) {
    const page = (await doc).addPage([PageSizes.A4[1], PageSizes.A4[0]])
    page.drawText(testCase, {
        x: 10,
        y: page.getHeight() - 20,
        size: 14
    })

    page.drawText(beforeStep, {
        x: 10,
        y: page.getHeight() - 50,
        size: 12
    })

    page.drawText(afterStep, {
        x: page.getWidth() / 2 + 10,
        y: page.getHeight() - 50,
        size: 12
    })
    let bimage = await (await doc).embedPng(fs.readFileSync(`./screenshots/${beforeImg}`))
    page.drawImage(bimage, {
        x: 20,
        y: page.getHeight() / 2,
        width: bimage.scale(0.2).width,
        height: bimage.scale(0.2).height,
    })
    let aimage = await (await doc).embedPng(fs.readFileSync(`./screenshots/${afterImg}`))
    page.drawImage(aimage, {
        x: page.getWidth() / 2 + 10,
        y: page.getHeight() / 2,
        width: aimage.scale(0.2).width,
        height: aimage.scale(0.2).height,
    })
}

function sliceIntoChunks(arr: TestInterfaces.TestAttachment[], chunkSize: number) {
    const res = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        const chunk = arr.slice(i, i + chunkSize);
        res.push(chunk);
    }
    return res;
}

pdf()