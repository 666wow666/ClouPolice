/**
 * 语音识别模块
 * 负责录音、与讯飞语音识别API通信、实时转写语音为文字
 * 数据持久化：通过 SidebarManager.saveTranscription() 保存到 data/interrogations.json
 */
(function() {
    var btnStatus = "UNDEFINED";
    var btnControl, resultElement, statusText;
    var resultText = "";
    var lastSentText = "";
    var recordedEntries = [];
    var lastSaveTime = 0;

    function initSpeechRecognition() {
        btnControl = document.getElementById("btn_control");
        resultElement = document.getElementById("result");
        statusText = document.getElementById("status_text");

        if (window.SpeechRecorder) {
            window.SpeechRecorder.init('public/js');
            window.SpeechRecorder.setCallbacks({
                onFrameRecorded: function(data) {
                    var wss = window._iatWSS;
                    if (wss && wss.readyState === wss.OPEN) {
                        wss.send(new Int8Array(data.frameBuffer));
                        if (data.isLastFrame) {
                            wss.send('{"end": true}');
                            changeBtnStatus('CLOSING');
                        }
                    }
                },
                onStop: function() {
                    console.log('[录音] 录音已停止，触发保存');
                    saveToServer(true);
                },
                onStart: function() {
                    changeBtnStatus('OPEN');
                },
                onError: function(error) {
                    console.error('录音错误:', error);
                    changeBtnStatus('CLOSED');
                }
            });
        }

        if (btnControl) {
            btnControl.onclick = function() {
                if (btnStatus === "UNDEFINED" || btnStatus === "CLOSED") {
                    connectWebSocket();
                } else if (btnStatus === "CONNECTING" || btnStatus === "OPEN") {
                    if (window.SpeechRecorder) {
                        window.SpeechRecorder.stop();
                    }
                }
            };
        }

        console.log('[语音识别] 模块初始化完成，当前文本长度:', resultText.length);
    }

    function getWebSocketUrl() {
        var url = "wss://rtasr.xfyun.cn/v1/ws";
        var appId = window.APPID;
        var secretKey = window.API_KEY;
        var ts = Math.floor(new Date().getTime() / 1000);
        var signa = hex_md5(appId + ts);
        var signatureSha = CryptoJSNew.HmacSHA1(signa, secretKey);
        var signature = CryptoJS.enc.Base64.stringify(signatureSha);
        signature = encodeURIComponent(signature);
        return url + "?appid=" + appId + "&ts=" + ts + "&signa=" + signature + "&roleType=2";
    }

    function changeBtnStatus(status) {
        btnStatus = status;
        var micIcon = document.querySelector('.compact-mic-icon');
        var recordingDots = document.getElementById('compactRecordingDots');
        var waveContainer = document.getElementById('wave-container');

        if (status === "OPEN") {
            if (micIcon) micIcon.style.display = 'none';
            if (recordingDots) recordingDots.classList.add('active');
            if (waveContainer) waveContainer.style.display = 'flex';
            if (statusText) statusText.textContent = "正在录音...";
            if (btnControl) btnControl.classList.add('recording');
        } else {
            if (micIcon) micIcon.style.display = 'block';
            if (recordingDots) recordingDots.classList.remove('active');
            if (waveContainer) waveContainer.style.display = 'none';
            if (status === "CLOSED") {
                if (statusText) statusText.textContent = "点击麦克风开始录音";
            }
            if (btnControl) btnControl.classList.remove('recording');
        }

        if (status === "CONNECTING") {
            if (statusText) statusText.textContent = "正在连接...";
        } else if (status === "CLOSING") {
            if (statusText) statusText.textContent = "正在关闭...";
        }
    }

    function renderResult(resultData) {
        var jsonData = JSON.parse(resultData);
        if (jsonData.action == "started") {
            console.log("[语音识别] 握手成功");
        } else if (jsonData.action == "result") {
            var data = JSON.parse(jsonData.data);
            var resultTextTemp = "";
            data.cn.st.rt.forEach(function(j) {
                j.ws.forEach(function(k) {
                    k.cw.forEach(function(l) {
                        resultTextTemp += l.w;
                    });
                });
            });
            var rolePrefix = "";
            var needNewLine = false;
            if (data.cn && data.cn.st && data.cn.st.rl !== undefined) {
                var rlValue = data.cn.st.rl;
                if (rlValue >= 1) {
                    rolePrefix = "角色" + rlValue + "：";
                    needNewLine = true;
                }
            }
            var isFinal = data.cn.st.type == 0;
            if (isFinal) {
                if (needNewLine) {
                    resultText += "\n" + rolePrefix + resultTextTemp;
                } else {
                    resultText += resultTextTemp;
                }
                var completeSentence = (needNewLine ? "\n" + rolePrefix : "") + resultTextTemp;
                var trimmedSentence = completeSentence.trim();
                if (trimmedSentence && trimmedSentence !== lastSentText) {
                    lastSentText = trimmedSentence;
                    var timestamp = new Date().toLocaleTimeString();
                    var isDuplicate = recordedEntries.some(function(entry) {
                        return entry.text === trimmedSentence;
                    });
                    if (!isDuplicate) {
                        recordedEntries.push({ time: timestamp, text: trimmedSentence });
                    }
                    if (window.Workflow1Module && window.Workflow1Module.send) {
                        window.Workflow1Module.send(trimmedSentence);
                    }
                }
                resultTextTemp = "";
            }
            if (resultElement) {
                resultElement.textContent = resultText + (needNewLine ? "\n" + rolePrefix : "") + resultTextTemp;
            }

            if (isFinal) {
                console.log('[语音识别] 已更新文本，触发保存，当前长度:', resultText.length);
                saveToServer(false);
            }
        } else if (jsonData.action == "error") {
            console.log("[语音识别] 错误:", jsonData);
            if (statusText) statusText.textContent = "错误: " + (jsonData.desc || "未知错误");
        }
    }

    function connectWebSocket() {
        var websocketUrl = getWebSocketUrl();
        var wss;
        if ("WebSocket" in window) {
            wss = new WebSocket(websocketUrl);
        } else if ("MozWebSocket" in window) {
            wss = new MozWebSocket(websocketUrl);
        } else {
            alert("浏览器不支持 WebSocket");
            return;
        }
        window._iatWSS = wss;
        changeBtnStatus("CONNECTING");
        wss.onopen = function(e) {
            console.log('[语音识别] WebSocket已连接，开始录音');
            if (window.SpeechRecorder) {
                window.SpeechRecorder.start({ sampleRate: 16000, frameSize: 1280 });
            }
        };
        wss.onmessage = function(e) { renderResult(e.data); };
        wss.onerror = function(e) {
            console.error('[语音识别] WebSocket错误:', e);
            if (window.SpeechRecorder) {
                window.SpeechRecorder.stop();
            }
            changeBtnStatus("CLOSED");
            if (statusText) statusText.textContent = "连接错误";
        };
        wss.onclose = function(e) {
            console.log('[语音识别] WebSocket已关闭，最终文本长度:', resultText.length);
            if (window.SpeechRecorder) {
                window.SpeechRecorder.stop();
            }
            changeBtnStatus("CLOSED");
            saveToServer(true);
        };
    }

    function saveToServer(immediate) {
        if (window.SidebarManager && typeof window.SidebarManager.saveTranscription === 'function') {
            window.SidebarManager.saveTranscription(resultText, immediate);
        }
    }

    function setResultText(text) {
        resultText = text || "";
        if (resultElement) {
            resultElement.textContent = resultText;
        }
        console.log('[语音识别] setResultText完成，长度:', resultText.length);
    }

    function getResultText() {
        return resultText;
    }

    function syncFromDom() {
        if (resultElement) {
            var domText = resultElement.textContent || "";
            resultText = domText;
        }
        return resultText;
    }

    function getRecordedEntries() {
        return recordedEntries;
    }

    window.SpeechRecognitionModule = {
        init: initSpeechRecognition,
        getResultText: getResultText,
        setResultText: setResultText,
        syncFromDom: syncFromDom,
        getRecordedEntries: getRecordedEntries,
        changeBtnStatus: changeBtnStatus
    };
})();
