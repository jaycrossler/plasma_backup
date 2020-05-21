const defaultLocale = 'en-US';
const localeRegExPattern = /^[a-z]{2}(-[A-Z]{2})?$/;
var msgCounter = 0;

function requestChatBot(loc) {
    msgCounter = 0;
    const params = new URLSearchParams(location.search);
    const locale = params.has('locale') ? extractLocale(params.get('locale')) : defaultLocale;
    const oReq = new XMLHttpRequest();
    oReq.addEventListener("load", initBotConversation);
    var path = "/chatBot?locale=" + locale;

    if (loc) {
        path += "&lat=" + loc.lat + "&long=" + loc.long;
    }
    if (params.has('userId')) {
        path += "&userId=" + params.get('userId');
    } else if (localStorage["plasma-coalition-bot"]) {
        path += "&userId=" + localStorage["plasma-coalition-bot"];
    }
    if (params.has('userName')) {
        path += "&userName=" + params.get('userName');
    }
    oReq.open("POST", path);
    oReq.send();
}

function extractLocale(localeParam) {
    if (localeParam === 'autodetect') {
        return navigator.language;
    }

    //Before assigning, ensure it's a valid locale string (xx or xx-XX)
    if (localeParam.search(localeRegExPattern) === 0) {
        return localeParam;
    }
    return defaultLocale;
}

function chatRequested() {
    const params = new URLSearchParams(location.search);
    if (params.has('shareLocation')) {
        getUserLocation(requestChatBot);
    } else {
        requestChatBot();
    }
}

function getUserLocation(callback) {
    navigator.geolocation.getCurrentPosition(
        function (position) {
            var latitude = position.coords.latitude;
            var longitude = position.coords.longitude;
            var location = {
                lat: latitude,
                long: longitude
            };
            callback(location);
        },
        function (error) {
            // user declined to share location
            console.log("location error:" + error.message);
            callback();
        });
}

function initBotConversation() {
    if (this.status >= 400) {
        alert(this.statusText);
        return;
    }
    // extract the data from the JWT
    const jsonWebToken = this.response;
    const tokenPayload = JSON.parse(atob(jsonWebToken.split('.')[1]));
    const user = {
        id: tokenPayload.userId,
        name: tokenPayload.userName,
        locale: tokenPayload.locale
    };

    localStorage["plasma-coalition-bot"] = tokenPayload.userId;
    let domain = undefined;
    if (tokenPayload.directLineURI) {
        domain = "https://" + tokenPayload.directLineURI + "/v3/directline";
    }
    var botConnection = window.WebChat.createDirectLine({
        token: tokenPayload.connectorToken,
        domain: domain
    });
    const styleOptions = {
        botAvatarImage: false,
        hideSendBox: true,
        botAvatarInitials: false,
        userAvatarInitials: false,
        backgroundColor: 'transparent',
        bubbleBackground: '#EFEFEF',
        bubbleBorderColor: '#EFEFEF',
        bubbleFromUserBackground: '#000000',
        bubbleFromUserBorderColor: '#000000',
        bubbleFromUserTextColor: '#ffffff',
        bubbleTextColor: '#000000',
        suggestedActionBackground: "red",
        hideScrollToEndButton: true
    };

    const store = window.WebChat.createStore({}, function (store) {
        return function (next) {
            return function (action) {
                if (action.type === 'DIRECT_LINE/CONNECT_FULFILLED') {
                    store.dispatch({
                        type: 'DIRECT_LINE/POST_ACTIVITY',
                        meta: {method: 'keyboard'},
                        payload: {
                            activity: {
                                type: "invoke",
                                name: "InitConversation",
                                locale: user.locale,
                                value: {
                                    jsonWebToken: jsonWebToken,
                                    triggeredScenario: {
                                        trigger: "find_plasma_center"
                                    }

                                }
                            }
                        }
                    });

                } else if (action.type === 'DIRECT_LINE/INCOMING_ACTIVITY') {
                    try {
                        if (action.payload.activity.entities[0].zip) {
                            store.dispatch({
                                type: 'WEB_CHAT/SEND_MESSAGE',
                                payload: {text: action.payload.activity.entities[0].zip}
                            });
                        }

                        setTimeout(function() {
                            if (action.payload.activity.entities[0].question) {
                                $('.ac-columnSet:not(.tocuhed)').addClass("question-buttons");
                            }
                            $('.ac-columnSet:not(.tocuhed)').addClass("touched");
                        }, 10);


                    } catch (e) {
                        // nothing
                    }
                    if (action.payload && action.payload.activity.type === "event" && action.payload.activity.name === "open_url") {
                        window.open(action.payload.activity.value.url, '_blank');
                    }
                    if (action.payload && action.payload.activity && action.payload.activity.type === "event" && action.payload.activity.name === "ShareLocationEvent") {
                        // share
                        getUserLocation(function (location) {
                            store.dispatch({
                                type: 'WEB_CHAT/SEND_POST_BACK',
                                payload: {value: JSON.stringify(location)}
                            });
                        });
                    }
                    forceScrollDown(action);

                } else if (action.type === 'WEB_CHAT/SEND_MESSAGE') {
                    setTimeout(function () {
                        removeOldButtons()
                    });
                } else if (action.type === 'WEB_CHAT/SEND_POST_BACK') {
                    setTimeout(function () {
                        removeOldButtons()
                    });
                }
                return next(action);
            }
        }
    });
    const webchatOptions = {
        directLine: botConnection,
        styleOptions: styleOptions,
        store: store,
        userID: user.id,
        username: user.name,
        locale: user.locale
    };
    startChat(user, webchatOptions);
}

function startChat(user, webchatOptions) {
    const botContainer = document.getElementById('webchat');
    window.WebChat.renderWebChat(webchatOptions, botContainer);
}

var botRequested = false;

function showBot() {
    if (menuOpen) {
        toggleMenu();
    }
    if (!botRequested) {
        requestChatBot();
        botRequested = true;
    }
    $('.panel').addClass('in');
    $('body').css('overflow-y', 'hidden');
}

function hideBot() {
    $('.panel').removeClass('in');
    $('body').css('overflow-y', 'scroll');
}

function restartConversation() {
    chatRequested();
}

var menuOpen = false;
function toggleMenu() {
    menuOpen = !menuOpen;
    $('nav').toggleClass("in");
}

function changeLocale(el) {
    location.href = "/" + el.value + location.hash;
}

$(document).ready(function () {
    setTimeout(function () {
        window.scroll(0, 0);
    }, 100);

    $('a[data-toggle="tab"]').on('shown.bs.tab', function () {
        window.scroll(0, 0);
        $('nav').removeClass("in");
    });
});

function removeOldButtons() {
    var ul = document.getElementById("webchat").getElementsByTagName("ul")[1];
    Array.from(ul.getElementsByTagName('button')).forEach(function (button) {
        button.remove();
    });
    Array.from(ul.getElementsByTagName('input')).forEach(function (textbox) {
        textbox.remove();
    });
    Array.from(ul.getElementsByClassName('ac-horizontal-separator')).forEach(function (line) {
        line.remove();
    });
}

function forceScrollDown(action) {
    if (action.type === 'DIRECT_LINE/INCOMING_ACTIVITY') {
        setTimeout(function () {
            document.querySelector('div.css-y1c0xs').scrollTop = document.querySelector('div.css-y1c0xs').scrollHeight
        });
    }
}

window.onscroll = function scrollFunction() {
    if (location.hash === "#home") {
        if (document.body.scrollTop > 0 || document.documentElement.scrollTop > 0) {
            $("body").removeClass("transparent-nav");
        } else {
            $("body").addClass("transparent-nav");
        }
    }
};

function setTabHome() {
    location.hash = '#home';
    $('#site-header').removeClass("short");
    $('.webchat-panel').removeClass("in");
    if (document.body.scrollTop > 0 || document.documentElement.scrollTop > 0) {
        $("body").removeClass("transparent-nav");
    } else {
        $("body").addClass("transparent-nav");
    }
}

function setTabHowItWorks() {
    location.hash = '#how-it-works';
    $('#site-header').addClass("short");
    $('.webchat-panel').removeClass("in");
    $("body").removeClass("transparent-nav");
}

function setTabAbout() {
    location.hash = '#about';
    $('#site-header').addClass("short");
    $('.webchat-panel').removeClass("in");
    $("body").removeClass("transparent-nav");
}
function setTabQnA() {
    location.hash = '#qna';
    $('#site-header').addClass("short");
    $('.webchat-panel').removeClass("in");
    $("body").removeClass("transparent-nav");
}

function setInitialTab(hash) {
    switch (hash) {
        case "#home":
            $('#home-tab').click();
            break;
        case "#how-it-works":
            $('#how-it-works-tab').click();
            break;
        case "#about":
            $('#about-tab').click();
            break;
        case "#qna":
            $('#qna-tab').click();
            break;
        default:
            $('#home-tab').click();
    }
}

function privacy() {
    $('#privacy-tab')[0].click();
    location.hash = '#privacy';
    $('#site-header').addClass("short");
    $('.webchat-panel').removeClass("in");
    $("body").removeClass("transparent-nav");

}

function terms() {
    $('#terms-tab')[0].click();
    location.hash = '#terms';
    $('#site-header').addClass("short");
    $('.webchat-panel').removeClass("in");
    $("body").removeClass("transparent-nav");
}
