import * as common from './common';
import * as nodeApi from 'azure-devops-node-api';
import * as TestApi from 'azure-devops-node-api/TestApi';
import * as TestInterfaces from 'azure-devops-node-api/interfaces/TestInterfaces';
import { PDFDocument, PDFPage, PageSizes } from 'pdf-lib'
import fs from 'fs'
import * as StreamPromises from "stream/promises";

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
                        x: page.getWidth()/ 2 + 10,
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

run()