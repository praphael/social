const apiHost="localhost:3000"
const baseURL="http://"+apiHost

function makeRequestObj(method, body, authToken="") {
    let req = { method: method, 
                headers: { 'Content-Type': 'application/json', 
                           'Authorization' : authToken
                         },

                mode: 'cors' };
    if (method == 'POST') {
        req.body = "";
        if (body != null && body != undefined)
            req.body = JSON.stringify(body);
    }
        
    return req;
}

async function doRequest(route, method, body, authToken, errHandler) {
    try {
        const requrl = baseURL + route;
        console.log("doRequest(): fetching '", requrl, "'", " body='", body, "'");
        const response = await fetch(requrl, makeRequestObj(method, body, authToken));
        const status = response.status;
        console.log("doRequest(): status= ", status);
        if (response.ok) {
            const r = await response.json();
            return r;
        } else {
            const errorMessage = await response.text();
            errHandler({route, status, errorMessage});
            return null;
        }
    } catch (error) {
        console.error(`'${route}' fetch error: ${error}`);
        errHandler(route, null, error);
        return null;
    }
}

function handleRequestError({route, status, errMsg}) {
    console.log("ERROR route: ", route, "status: ", status, " error: ", errMsg);
    //alert(route, " failed status ", status, " \nerror message:\n", errMsg);
}

export {doRequest, handleRequestError, makeRequestObj};

