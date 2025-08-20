export function initSequencePlayer(options) {
    const {
        loadGLB,
        loadGLBPrepared, // returns prepared THREE.Group without adding to scene
        disposeCurrentModel,
        requestRender,
        buttons,
        defaultConfig,
        // Optional advanced swap API: avoids VR flicker by disposing the previous AFTER the new is added
        getCurrentModel,
        disposeModel,
        queueSceneForSwap
    } = options;

    const sequenceConfig = { ...defaultConfig };

    // Allow overrides via URL params: ?sequencePath=/path&fps=15&end=80&start=0
    try {
        const params = new URLSearchParams(window.location.search);
        const path = params.get('sequencePath');
        const fps = params.get('fps');
        const end = params.get('end');
        const start = params.get('start');
        if (path) sequenceConfig.basePath = path;
        if (fps && !Number.isNaN(Number(fps))) sequenceConfig.fps = Math.max(1, Number(fps));
        if (end && !Number.isNaN(Number(end))) sequenceConfig.endFrame = Number(end);
        if (start && !Number.isNaN(Number(start))) sequenceConfig.startFrame = Number(start);
    } catch (e) {
        console.warn('Failed to parse URL params for sequence config', e);
    }

    let isSequencePlaying = false;
    let sequenceFrame = sequenceConfig.startFrame;
    let sequenceTimer = null;

    function setUIPlayingState(playing) {
        const playBtn = document.getElementById(buttons.playId);
        const stopBtn = document.getElementById(buttons.stopId);
        const nextBtn = document.getElementById(buttons.nextId);
        if (playBtn) playBtn.disabled = playing;
        if (stopBtn) stopBtn.disabled = !playing;
        if (nextBtn) nextBtn.disabled = playing;
    }

    function formatFrameNumber(frame) {
        return String(frame).padStart(sequenceConfig.pad, '0');
    }

    function buildSequenceUrl(frame) {
        return `${sequenceConfig.basePath}/${sequenceConfig.prefix}${formatFrameNumber(frame)}${sequenceConfig.suffix}`;
    }

    function playNextFrame() {
        if (!isSequencePlaying) return;
        if (sequenceFrame > sequenceConfig.endFrame) {
            stop();
            return;
        }

        const url = buildSequenceUrl(sequenceFrame);
        const targetFrame = sequenceFrame;
        if (loadGLBPrepared && queueSceneForSwap) {
            // Prepare next scene off-thread, then atomically swap at frame boundary to prevent VR flicker
            loadGLBPrepared(url)
                .then((preparedScene) => {
                    queueSceneForSwap(preparedScene);
                })
                .catch(() => {})
                .finally(() => {
                    if (!isSequencePlaying) return;
                    sequenceFrame = targetFrame + 1;
                    const delayMs = Math.max(1, Math.floor(1000 / sequenceConfig.fps));
                    sequenceTimer = setTimeout(playNextFrame, delayMs);
                    if (requestRender) requestRender();
                });
        } else {
            // Fallback: dispose before load (non-VR scenarios)
            if (disposeCurrentModel) disposeCurrentModel();
            loadGLB(url)
                .catch(() => {})
                .finally(() => {
                    if (!isSequencePlaying) return;
                    sequenceFrame = targetFrame + 1;
                    const delayMs = Math.max(1, Math.floor(1000 / sequenceConfig.fps));
                    sequenceTimer = setTimeout(playNextFrame, delayMs);
                    if (requestRender) requestRender();
                });
        }
    }

    function start() {
        if (isSequencePlaying) return;
        isSequencePlaying = true;
        sequenceFrame = sequenceConfig.startFrame;
        setUIPlayingState(true);
        playNextFrame();
    }

    function stop() {
        isSequencePlaying = false;
        if (sequenceTimer) {
            clearTimeout(sequenceTimer);
            sequenceTimer = null;
        }
        setUIPlayingState(false);
    }

    const playBtn = document.getElementById(buttons.playId);
    const stopBtn = document.getElementById(buttons.stopId);
    if (playBtn) playBtn.addEventListener('click', start);
    if (stopBtn) stopBtn.addEventListener('click', stop);

    return {
        start,
        stop,
        isPlaying: () => isSequencePlaying,
        config: sequenceConfig
    };
}


