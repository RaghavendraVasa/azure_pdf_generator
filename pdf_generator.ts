import * as common from './common';
import * as nodeApi from 'azure-devops-node-api';
import * as TestApi from 'azure-devops-node-api/TestApi';
import * as TestInterfaces from 'azure-devops-node-api/interfaces/TestInterfaces';
import { PDFDocument, PageSizes } from 'pdf-lib'
import fs from 'fs'
import * as StreamPromises from "stream/promises";
const doc = PDFDocument.create()

async function pdf(runId: number) {
    const projectId: string = common.getProject();
    const webApi: nodeApi.WebApi = await common.getWebApi();
    const testApiObject: TestApi.ITestApi = await webApi.getTestApi();
    const testResultsByRunId: TestInterfaces.TestCaseResult[] = await testApiObject.getTestResults(projectId, runId)

    if (!fs.existsSync('./screenshots')) {
        fs.mkdirSync('./screenshots', { recursive: true })
    }

    await Promise.all(testResultsByRunId.map(async (testResult) => {
        const attachments: TestInterfaces.TestAttachment[] = await testApiObject.getTestResultAttachments(projectId, runId, testResult.id as number)

        let filtered_attachments = attachments.filter(function (attachment) {
            if (attachment.fileName?.endsWith('.png')) {
                return attachment;
            }
        })

        await Promise.all(filtered_attachments.map(async (attachment) => {
            let readableStream: NodeJS.ReadableStream = await testApiObject.getTestResultAttachmentContent(projectId, runId, testResult.id as number, attachment.id)
            let writableStream = fs.createWriteStream(`./screenshots/${attachment.fileName}`)
            await StreamPromises.pipeline(readableStream, writableStream);
        }))

        let dividedArray = sliceIntoChunks(filtered_attachments, 2)

        for (let i = 0; i < dividedArray.length; i++) {
            if (dividedArray[i].length == 2 && dividedArray[i][0].fileName?.startsWith('Before') && dividedArray[i][1].fileName?.startsWith('After')) {
                createPage(testResult.testCaseTitle as string, testResult.outcome as string, dividedArray[i][0].fileName?.split('_').join(' ') as string,
                    dividedArray[i][0].fileName as string, dividedArray[i][1].fileName?.split('_').join(' ') as string, dividedArray[i][1].fileName as string)
            }
            else if (dividedArray[i].length == 1 && dividedArray[i][0].fileName?.startsWith('Before')) {
                createPage(testResult.testCaseTitle as string, testResult.outcome as string, dividedArray[i][0].fileName?.split('_').join(' ') as string,
                    dividedArray[i][0].fileName as string)
            }
        }
    }))
    fs.writeFileSync(`./Run-${runId}.pdf`, await (await doc).save())
    fs.rmSync('./screenshots/',{recursive: true})
}

async function createPage(testCase: string, status: string, beforeStep: string, beforeImg: string, afterStep?: string, afterImg?: string) {
    const page = (await doc).addPage([PageSizes.A4[1], PageSizes.A4[0]])
    page.drawText(`Test case name: ${testCase}`, {
        x: 20,
        y: page.getHeight() - 20,
        size: 14
    })

    page.drawText(`Status: ${status}`, {
        x: page.getWidth() - 120,
        y: page.getHeight() - 20,
        size: 14
    })

    page.drawText(beforeStep, {
        x: 20,
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

    if (typeof afterStep !== 'undefined') {
        page.drawText(afterStep as string, {
            x: page.getWidth() / 2 + 10,
            y: page.getHeight() - 50,
            size: 12
        })
    }

    if (typeof afterImg !== 'undefined') {
        let aimage = await (await doc).embedPng(fs.readFileSync(`./screenshots/${afterImg}`))
        page.drawImage(aimage, {
            x: page.getWidth() / 2 + 10,
            y: page.getHeight() / 2,
            width: aimage.scale(0.2).width,
            height: aimage.scale(0.2).height,
        })
    }
}

function sliceIntoChunks(arr: TestInterfaces.TestAttachment[], chunkSize: number) {
    const res = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        const chunk = arr.slice(i, i + chunkSize);
        res.push(chunk);
    }
    return res;
}

pdf(234)
