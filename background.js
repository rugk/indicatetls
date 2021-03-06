var versionIconMap = new Map();
versionIconMap.set('TLSv1.3', 'icons/tlsv13.png'); 
versionIconMap.set('TLSv1.2', 'icons/tlsv12.png'); 
versionIconMap.set('TLSv1.1', 'icons/tlsv11.png'); 
versionIconMap.set('TLSv1', 'icons/tlsv10.png'); 
versionIconMap.set('SSLv3', 'icons/sslv3.png'); /* no longer supported */
versionIconMap.set('unknown', 'icons/tlsunknown.png');

var versionComparisonMap = new Map();
versionComparisonMap.set('TLSv1.3', 13); 
versionComparisonMap.set('TLSv1.2', 12); 
versionComparisonMap.set('TLSv1.1', 11); 
versionComparisonMap.set('TLSv1', 10); 
versionComparisonMap.set('SSLv3', 3); 
versionComparisonMap.set('unknown', 0);

var tabMainProtocolMap = new Map();
var tabSubresourceProtocolMap = new Map();

async function updateIcon(tabId, protocolVersion) {
    browser.pageAction.setIcon({
        tabId: tabId, path: versionIconMap.get(protocolVersion)
    }); 
    browser.pageAction.setTitle({tabId: tabId, title: protocolVersion});
    browser.pageAction.setPopup({tabId: tabId, popup: "/popup/popup.html"});
}

function getSubresourceMap(tabId) {
    /* fill table for subresources*/	
    if (!tabSubresourceProtocolMap.has(tabId)) {
        tabSubresourceProtocolMap.set(tabId, new Map());
    }
    var subresourceMap = tabSubresourceProtocolMap.get(tabId);
    return subresourceMap;
}

async function processSecurityInfo(details) {

    try {
        var host = (new URL(details.url)).host;


        let securityInfo = await browser.webRequest.getSecurityInfo(details.requestId,{certificateChain:false});
        if (typeof securityInfo === "undefined") {
            return;
        }

        /* set the icon correctly */
        if (details.type === 'main_frame') {
            tabMainProtocolMap.set(details.tabId, securityInfo.protocolVersion);
            await updateIcon(details.tabId, securityInfo.protocolVersion);
        } else {
            cached_version = tabMainProtocolMap.get(details.tabId);
            if (typeof cached_version !== "undefined") {
                await updateIcon(details.tabId, cached_version);
            }
        }


        var subresourceMap = getSubresourceMap(details.tabId);
        subresourceMap.set(host, securityInfo);
        tabSubresourceProtocolMap.set(details.tabId, subresourceMap);

        /*var mainProtocolVersion = versionComparisonMap.get(tabMainProtocolMap.get(details.tabId));
        for (const securityInfo of subresourceMap.values()) {
            if (versionComparisonMap.get(securityInfo.protocolVersion) < mainProtocolVersion) {
                await updateIcon(details.tabId, tabMainProtocolMap.get(details.tabId), true);
                break;
            }
        }*/

    } catch(error) {
        console.error(error);
    }
}

function handleNavigation(details) {
    /* we are about to load a new page, delete old data */
    tabSubresourceProtocolMap.set(details.tabId, new Map());
}

browser.webRequest.onHeadersReceived.addListener(processSecurityInfo,
    {urls: ["https://*/*"]}, ["blocking", "responseHeaders"]
);

browser.pageAction.onClicked.addListener((tab) => {
 /* future */
});


var filter = {  url: [{schemes: ["https"]} ]};
browser.webNavigation.onBeforeNavigate.addListener(handleNavigation, filter);

/* Event Listener for incoming messages */
function handleMessage(request, sender, sendResponse) {
    var response;
    try {
        switch (request.type) {
            case 'request':
                const is_undefined = typeof request.key === 'undefined';
                if (request.resource === 'tabSubresourceProtocolMap') {
                    response = {
                        requested_info: is_undefined ? tabSubresourceProtocolMap : tabSubresourceProtocolMap.get(request.key)
                    };
                } else if (request.resource === 'tabMainProtocolMap') {
                    response = {
                        requested_info: is_undefined ? tabMainProtocolMap : tabMainProtocolMap.get(request.key)
                    };
                } else if (request.resource === 'versionComparisonMap') {
                    response = {
                        requested_info: is_undefined ? versionComparisonMap : versionComparisonMap.get(request.key)
                    };
                } else {
                    response = new Error(browser.i18n.getMessage('invalidResourceRequest'));
                }
                break;
            default:
                response = new Error(browser.i18n.getMessage('invalidMessageRequest'));
        }
    } catch (e) {
        response = e;
    }
    sendResponse(response);
}
browser.runtime.onMessage.addListener(handleMessage);
