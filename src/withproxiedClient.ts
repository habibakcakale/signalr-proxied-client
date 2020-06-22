import { HubConnectionBuilder, HttpTransportType, IHttpConnectionOptions } from '@microsoft/signalr';
import { createProxiedClient } from './createProxiedClient';
import WS from "ws";
(async function () {

    var httpClient = createProxiedClient({
        //host: "127.0.0.1",
        //port: "8888"
    });
    var options: IHttpConnectionOptions = {
        httpClient: new httpClient(),
        transport: HttpTransportType.ServerSentEvents
    }
    var builder = new HubConnectionBuilder().withUrl("http://localhost:5000/loghub", options).build();
    builder.on("connected", args => {
        console.log(args)
    })
    await builder.start();

})()


