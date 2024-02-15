import * as vm from "azure-devops-node-api";
import * as dotenv from 'dotenv'
dotenv.config()

export async function getWebApi(this: any, serverUrl?: string): Promise<vm.WebApi> {
    serverUrl = serverUrl || 'https://dev.azure.com/CelitoTech';
    return await this.getApi(serverUrl);
}

export async function getApi(serverUrl: string): Promise<vm.WebApi> {
    return new Promise<vm.WebApi>(async (resolve, reject) => {
        try {
            let token = process.env.AZURE_TOKEN as string;
            let authHandler = vm.getPersonalAccessTokenHandler(token);
            let option = undefined;
            let vsts: vm.WebApi = new vm.WebApi(serverUrl, authHandler, option);
            await vsts.connect();
            resolve(vsts);
        }
        catch (err) {
            reject(err);
        }
    });
}

export function getProject(): string {
    return 'Quality System';
}
