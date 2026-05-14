(function() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const countDisplay = document.getElementById('countDisplay');
  const rightAngleEl = document.getElementById('rightAngle');
  const leftAngleEl = document.getElementById('leftAngle');
  const feedback = document.getElementById('feedback');
  const resetBtn = document.getElementById('resetBtn');
  const modalOverlay = document.getElementById('modalOverlay');
  const setGoalBtn = document.getElementById('setGoalBtn');
  const goFailureBtn = document.getElementById('goFailureBtn');
  const goalInputWrapper = document.getElementById('goalInputWrapper');
  const goalInput = document.getElementById('goalInput');
  const startGoalBtn = document.getElementById('startGoalBtn');
  const goalProgress = document.getElementById('goalProgress');
  const lightGreen = document.getElementById('lightGreen');
  const lightRed = document.getElementById('lightRed');
  const videoWrapper = document.querySelector('.video-wrapper');
  const bestScoreDisplay = document.getElementById('bestScoreDisplay');
  const bestScoreValue = document.getElementById('bestScoreValue');
  const perfectDisplay = document.getElementById('perfectCount');
  const partialDisplay = document.getElementById('partialCount');
  const celebrationOverlay = document.getElementById('celebrationOverlay');
  const confettiContainer = document.getElementById('confettiContainer');
  const celebrationGoal = document.getElementById('celebrationGoal');
  const celebrationCompleted = document.getElementById('celebrationCompleted');
  const celebrationBestValue = document.getElementById('celebrationBestValue');
  const newWorkoutBtn = document.getElementById('newWorkoutBtn');

  // Challenge DOM refs
  const challengeFriendBtn = document.getElementById('challengeFriendBtn');
  const namePromptOverlay = document.getElementById('namePromptOverlay');
  const challengerNameInput = document.getElementById('challengerNameInput');
  const startChallengeBtn = document.getElementById('startChallengeBtn');
  const challengeIntroOverlay = document.getElementById('challengeIntroOverlay');
  const challengeIntroTitle = document.getElementById('challengeIntroTitle');
  const challengeIntroText = document.getElementById('challengeIntroText');
  const friendNameInput = document.getElementById('friendNameInput');
  const acceptChallengeBtn = document.getElementById('acceptChallengeBtn');
  const shareOverlay = document.getElementById('shareOverlay');
  const shareScoreText = document.getElementById('shareScoreText');
  const shareBadRepsSection = document.getElementById('shareBadRepsSection');
  const shareBadRepsGrid = document.getElementById('shareBadRepsGrid');
  const challengeLink = document.getElementById('challengeLink');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  const shareDoneBtn = document.getElementById('shareDoneBtn');
  const resultOverlay = document.getElementById('resultOverlay');
  const resultChallengerName = document.getElementById('resultChallengerName');
  const resultChallengerScore = document.getElementById('resultChallengerScore');
  const resultChallengerBadReps = document.getElementById('resultChallengerBadReps');
  const resultMyName = document.getElementById('resultMyName');
  const resultMyScore = document.getElementById('resultMyScore');
  const resultMyBadReps = document.getElementById('resultMyBadReps');
  const winnerDisplay = document.getElementById('winnerDisplay');
  const winnerText = document.getElementById('winnerText');
  const resultBadRepsSection = document.getElementById('resultBadRepsSection');
  const resultBadRepsGrid = document.getElementById('resultBadRepsGrid');
  const suddenDeathSection = document.getElementById('suddenDeathSection');
  const suddenDeathBtn = document.getElementById('suddenDeathBtn');
  const resultShareBtn = document.getElementById('resultShareBtn');
  const resultDoneBtn = document.getElementById('resultDoneBtn');
  const finishChallengeBtn = document.getElementById('finishChallengeBtn');

  // Challenge state
  let challengeMode = false;
  let isChallenger = false;
  let playerName = '';
  let challengerName = '';
  let challengerScore = 0;
  let challengerBadReps = 0;
  let challengeBadRepCount = 0;
  let challengeFinished = false;

  let repCount = 0;
  let leftGripping = false;
  let rightGripping = false;

  let workoutMode = null;
  let goalReps = 0;
  let goalReached = false;
  let wrongRepScreenshots = [];

  const RIGHT = { shoulder:12, elbow:14, wrist:16, hip:24 };
  const LEFT  = { shoulder:11, elbow:13, wrist:15, hip:23 };

  const EXTENDED_THRESHOLD = 155;
  const CURLED_THRESHOLD   = 50;
  const CONFIRM_FRAMES     = 5;
  const COOLDOWN_MS        = 600;
  const PROXIMITY_THRESH      = 0.22;
  const PARTIAL_REP_THRESHOLD = 90;
  const MAX_SWING_ANGLE = 35;
  const ELBOW_Z_THRESHOLD = 0.25;
  const GRACE_FRAMES = 5;
  const DEPTH_BUFFER_SIZE = 5;

  function getBestScore() {
    return parseInt(localStorage.getItem('bestScore') || '0', 10);
  }

  function saveBestScore(score) {
    const current = getBestScore();
    if (score > current) {
      localStorage.setItem('bestScore', score.toString());
      bestScoreValue.textContent = score;
      bestScoreDisplay.style.display = '';
    }
  }

  function createArmState() {
    return {
      state:'down',
      totalCount:0, perfectCount:0, partialCount:0,
      angle:0,
      downStreak:0, upStreak:0,
      lastRepTime:0,
      minAngle:180, prevAngle:0,
      peakSwing: 0,
      currentSwing: 0,
      maxDepthDiff: 0,
      currentDepthDiff: 0,
      avgDepthDiff: 0,
      depthBuffer: [],
      badFrameStreak: 0,
      maxBadStreak: 0
    };
  }

  let arms = { right:createArmState(), left:createArmState() };

  let camera = null;

  const storedBest = getBestScore();
  if (storedBest > 0) {
    bestScoreDisplay.style.display = '';
    bestScoreValue.textContent = storedBest;
  }

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function playSound(freq = 880, duration = 0.1, type = 'sine') {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  canvas.width = 640;
  canvas.height = 480;

  function angleBetween(a, b, c) {
    const radians = Math.atan2(c.y - b.y, c.x - b.x)
                  - Math.atan2(a.y - b.y, a.x - b.x);
    let deg = Math.abs(radians * 180 / Math.PI);
    if (deg > 180) deg = 360 - deg;
    return deg;
  }

  function wristNearShoulder(w, s) {
    const dx = w.x - s.x;
    const dy = w.y - s.y;
    return Math.sqrt(dx*dx + dy*dy) < PROXIMITY_THRESH;
  }

  function checkGrip(landmarks) {
    const wrist = landmarks[0];
    const tips = [4, 8, 12, 16, 20];
    const mcps = [1, 5, 9, 13, 17];
    let tipToWrist = 0, mcpToWrist = 0;
    for (const tIdx of tips) {
      const t = landmarks[tIdx];
      tipToWrist += Math.sqrt((t.x - wrist.x)**2 + (t.y - wrist.y)**2);
    }
    for (const mIdx of mcps) {
      const m = landmarks[mIdx];
      mcpToWrist += Math.sqrt((m.x - wrist.x)**2 + (m.y - wrist.y)**2);
    }
    tipToWrist /= tips.length;
    mcpToWrist /= mcps.length;
    return tipToWrist / Math.max(mcpToWrist, 0.01) < 1.4;
  }

  function updateGripUI() {
    // Grip UI removed
  }

  function updateUI(angleEl, armState) {
    if (armState.angle > 0) {
      const a = Math.round(armState.angle);
      angleEl.textContent = a + '\u00B0';
      if (a < CURLED_THRESHOLD) {
        angleEl.className = 'value curl';
      } else if (a > EXTENDED_THRESHOLD) {
        angleEl.className = 'value good';
      } else {
        angleEl.className = 'value neutral';
      }
    } else {
      angleEl.textContent = '--';
      angleEl.className = 'value neutral';
    }
  }

  function isGripping(side) {
    return true; // Dumbbell no longer required
  }

  function isHandDetected(side) {
    return true; // Simplify
  }

  function updateFeedback(armState, side) {
    const visible = armState.angle > 0;
    // Red light if they try to curl without full extension
    if (visible && armState.state === 'down' && armState.angle < EXTENDED_THRESHOLD - 20 && armState.angle > CURLED_THRESHOLD + 20) {
      if (!armState.wasWrong) {
         // This is a simple heuristic for "wrong" rep - moving in the middle without hitting extremes
      }
    }
    return false;
  }

  function flashLight(light, className) {
    light.classList.add(className);
    setTimeout(() => light.classList.remove(className), 800);
  }

  function flashBorder() {
    document.body.classList.add('rep-done');
    videoWrapper.classList.add('rep-done');
    setTimeout(() => {
      document.body.classList.remove('rep-done');
      videoWrapper.classList.remove('rep-done');
    }, 800);
  }

  function flashBorderRed() {
    document.body.classList.add('rep-wrong');
    videoWrapper.classList.add('rep-wrong');
    setTimeout(() => {
      document.body.classList.remove('rep-wrong');
      videoWrapper.classList.remove('rep-wrong');
    }, 800);
  }

  function spawnConfetti() {
    const colors = ['#e94560','#ffd93d','#4ecca3','#82aaff','#ff6b6b','#a29bfe','#fd79a8','#ffeaa7'];
    for (let i = 0; i < 80; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.left = Math.random() * 100 + '%';
      el.style.width = (6 + Math.random() * 8) + 'px';
      el.style.height = (6 + Math.random() * 8) + 'px';
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      el.style.animationDuration = (2 + Math.random() * 3) + 's';
      el.style.animationDelay = Math.random() * 1.5 + 's';
      el.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';
      confettiContainer.appendChild(el);
    }
    setTimeout(() => confettiContainer.innerHTML = '', 5000);
  }

  function stopCamera() {
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop());
      video.srcObject = null;
    }
  }

  function processArm(landmarks, arm, armState, side) {
    if (goalReached) return;
    const s = landmarks[arm.shoulder];
    const e = landmarks[arm.elbow];
    const w = landmarks[arm.wrist];
    const h = landmarks[arm.hip];

    if (!s || !e || !w || s.visibility < 0.5 || e.visibility < 0.5 || w.visibility < 0.5) {
      armState.angle = 0;
      armState.currentSwing = 0;
      armState.downStreak = 0;
      armState.upStreak = 0;
      return;
    }

    const angle = angleBetween(s, e, w);
    armState.angle = angle;

    if (h && h.visibility >= 0.5) {
      armState.currentSwing = angleBetween(h, s, e);
    } else {
      armState.currentSwing = 0;
    }

    armState.currentDepthDiff = s.z - e.z;
    armState.depthBuffer.push(armState.currentDepthDiff);
    if (armState.depthBuffer.length > DEPTH_BUFFER_SIZE) {
      armState.depthBuffer.shift();
    }
    var sum = 0;
    for (var i = 0; i < armState.depthBuffer.length; i++) {
      sum += armState.depthBuffer[i];
    }
    armState.avgDepthDiff = sum / armState.depthBuffer.length;

    const now = performance.now();

    if (!isGripping(side)) {
      armState.downStreak = 0;
      armState.upStreak = 0;
      return;
    }

    const angleDiff = angle - armState.prevAngle;
    const curling = armState.prevAngle > 0 && angleDiff < -2;
    armState.prevAngle = angle;

    if (curling && angle < armState.minAngle) {
      armState.minAngle = angle;
    }

    const isExtended = angle > EXTENDED_THRESHOLD;
    const isCurled   = angle < CURLED_THRESHOLD;

    if (isExtended) {
      armState.downStreak = Math.min(armState.downStreak + 1, CONFIRM_FRAMES + 1);
      armState.upStreak = 0;

      if (armState.downStreak >= CONFIRM_FRAMES && now - armState.lastRepTime > COOLDOWN_MS) {
        let counted = false;
        let isPerfect = false;

        if (armState.state === 'up_complete') {
          var exceededSwing = armState.peakSwing > MAX_SWING_ANGLE;
          var exceededDepth = armState.maxDepthDiff > ELBOW_Z_THRESHOLD;
          var sustainedBad = armState.maxBadStreak >= GRACE_FRAMES;
          var elbowBad = sustainedBad && (exceededSwing || exceededDepth);
          if (!elbowBad) {
            armState.perfectCount++;
            isPerfect = true;
          } else {
            armState.partialCount++;
          }
          counted = true;
        } else if (armState.state === 'up_partial') {
          armState.partialCount++;
          counted = true;
        } else if (armState.minAngle < PARTIAL_REP_THRESHOLD) {
          armState.partialCount++;
          counted = true;
        }

        if (counted) {
          var isBadInChallenge = workoutMode === 'challenge' && !isPerfect;

          if (!isBadInChallenge) {
            armState.totalCount++;
            armState.lastRepTime = now;
          }

          if (workoutMode === 'challenge') {
            repCount = arms.right.perfectCount + arms.left.perfectCount;
          } else {
            repCount = arms.right.totalCount + arms.left.totalCount;
          }
          countDisplay.textContent = repCount;
          perfectDisplay.textContent = arms.right.perfectCount + arms.left.perfectCount;
          partialDisplay.textContent = arms.right.partialCount + arms.left.partialCount;
          updateGoalDisplay();
          checkGoalReached();

          if (isPerfect) {
            flashLight(lightGreen, 'active-green');
            flashBorder();
            playSound(660, 0.15);
            feedback.textContent = 'Perfect rep!';
            feedback.className = 'feedback good';
          } else {
            flashLight(lightRed, 'active-red');
            flashBorderRed();
            playSound(220, 0.2, 'sawtooth');
            if (isBadInChallenge) {
              feedback.textContent = 'Bad rep - keep form!';
            } else if (armState.state === 'up_partial') {
              feedback.textContent = 'Partial rep - fix form!';
            } else if (armState.state === 'up_complete') {
              feedback.textContent = 'Elbow swung - keep it fixed!';
            } else {
              feedback.textContent = 'Partial rep - full range!';
            }
            feedback.className = 'feedback curl';
          }

          setTimeout(function() {
            if (!goalReached && (feedback.classList.contains('good') || feedback.classList.contains('curl'))) {
              feedback.textContent = workoutMode === 'challenge' && !challengeFinished ? 'Keep going! Press Finish when done.' : 'Keep going!';
              feedback.className = 'feedback neutral';
            }
          }, 600);
        }

        armState.peakSwing = 0;
        armState.maxDepthDiff = 0;
        armState.badFrameStreak = 0;
        armState.maxBadStreak = 0;
        armState.depthBuffer = [];
        armState.avgDepthDiff = 0;
        armState.state = 'down';
        armState.downStreak = 0;
        armState.minAngle = 180;
      }
      } else if (isCurled) {
        if (armState.currentSwing > armState.peakSwing) {
          armState.peakSwing = armState.currentSwing;
        }
        if (armState.avgDepthDiff > armState.maxDepthDiff) {
          armState.maxDepthDiff = armState.avgDepthDiff;
        }

        var frameBad = armState.currentSwing > MAX_SWING_ANGLE || armState.avgDepthDiff > ELBOW_Z_THRESHOLD;
        if (frameBad) {
          armState.badFrameStreak++;
          if (armState.badFrameStreak == GRACE_FRAMES) {
            html2canvas(videoWrapper, { useCORS: true, scale: 0.5 }).then(function(c) {
              wrongRepScreenshots.push(c.toDataURL());
            });
          }
        } else {
          armState.badFrameStreak = 0;
        }
        if (armState.badFrameStreak > armState.maxBadStreak) {
          armState.maxBadStreak = armState.badFrameStreak;
        }

      armState.upStreak = Math.min(armState.upStreak + 1, CONFIRM_FRAMES + 1);
      armState.downStreak = 0;

      if (armState.state === 'down' && armState.upStreak >= CONFIRM_FRAMES) {
        const wristNear = wristNearShoulder(w, s);

        if (wristNear) {
          armState.state = 'up_complete';
          playSound(440, 0.05);
        } else {
          armState.state = 'up_partial';
          feedback.textContent = 'Bring wrist to shoulder!';
          feedback.className = 'feedback curl';
          playSound(220, 0.2, 'sawtooth');
          html2canvas(videoWrapper, { useCORS: true, scale: 0.5 }).then(function(c) {
            wrongRepScreenshots.push(c.toDataURL());
          });
        }
        armState.upStreak = 0;
      }
    } else {
      if (armState.currentSwing > armState.peakSwing) {
        armState.peakSwing = armState.currentSwing;
      }
      if (armState.avgDepthDiff > armState.maxDepthDiff) {
        armState.maxDepthDiff = armState.avgDepthDiff;
      }

      var frameBad = armState.currentSwing > MAX_SWING_ANGLE || armState.avgDepthDiff > ELBOW_Z_THRESHOLD;
      if (frameBad) {
        armState.badFrameStreak++;
        if (armState.badFrameStreak == GRACE_FRAMES) {
          html2canvas(videoWrapper, { useCORS: true, scale: 0.5 }).then(function(c) {
            wrongRepScreenshots.push(c.toDataURL());
          });
        }
      } else {
        armState.badFrameStreak = 0;
      }
      if (armState.badFrameStreak > armState.maxBadStreak) {
        armState.maxBadStreak = armState.badFrameStreak;
      }
      armState.downStreak = 0;
      armState.upStreak = 0;
    }
  }

  function drawLandmarks(landmarks, cw, ch) {
    ctx.clearRect(0, 0, cw, ch);

    const armCfgs = [
      { side: RIGHT, shoulder: RIGHT.shoulder, elbow: RIGHT.elbow, wrist: RIGHT.wrist },
      { side: LEFT,  shoulder: LEFT.shoulder,  elbow: LEFT.elbow,  wrist: LEFT.wrist  }
    ];

    for (const cfg of armCfgs) {
      const s = landmarks[cfg.shoulder];
      const e = landmarks[cfg.elbow];
      const wr = landmarks[cfg.wrist];
      if (!s || !e || !wr || s.visibility < 0.15 || e.visibility < 0.15 || wr.visibility < 0.15) continue;

      const gripping = isGripping(cfg.side);
      const color = gripping ? 'rgba(78,204,163,0.8)' : 'rgba(233,69,96,0.5)';
      const lw = gripping ? 4 : 2;

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.moveTo((1 - s.x) * cw, s.y * ch);
      ctx.lineTo((1 - e.x) * cw, e.y * ch);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.moveTo((1 - e.x) * cw, e.y * ch);
      ctx.lineTo((1 - wr.x) * cw, wr.y * ch);
      ctx.stroke();

      for (const [pidx, p] of [[cfg.shoulder, s], [cfg.elbow, e], [cfg.wrist, wr]]) {
        const isElbow = (pidx === cfg.elbow);
        const dotColor = isElbow ? '#ffd93d' : (gripping ? '#4ecca3' : '#e94560');
        ctx.beginPath();
        ctx.fillStyle = dotColor;
        ctx.arc((1 - p.x) * cw, p.y * ch, isElbow ? 6 : 4, 0, 2 * Math.PI);
        ctx.fill();
      }

      const angle = cfg.side === RIGHT ? arms.right.angle : arms.left.angle;
      if (angle > 0) {
        ctx.fillStyle = '#fff';
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(angle) + '\u00B0', (1 - e.x) * cw, (e.y * ch) - 14);
      }

      const st = cfg.side === RIGHT ? arms.right : arms.left;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      const label = cfg.side === RIGHT ? 'R' : 'L';
      ctx.fillText(label + ' swing:' + Math.round(st.currentSwing) + '\u00B0 peak:' + Math.round(st.peakSwing) + '\u00B0 depth:' + st.avgDepthDiff.toFixed(3), 8, ch - (cfg.side === RIGHT ? 36 : 18));

      var frameBad = st.currentSwing > MAX_SWING_ANGLE || st.avgDepthDiff > ELBOW_Z_THRESHOLD;
      if (frameBad) {
        if (st.badFrameStreak >= GRACE_FRAMES) {
          ctx.fillStyle = '#e94560';
          ctx.font = 'bold 22px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('STABILIZE ELBOW!', cw / 2, 30);
        } else {
          ctx.fillStyle = '#ffd93d';
          ctx.font = 'bold 20px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('STABILIZE ELBOW!', cw / 2, 30);
        }
      }
    }
  }

  const pose = new Pose({
    locateFile: f => 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/' + f
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.5
  });

  const hands = new Hands({
    locateFile: f => 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/' + f
  });

  let leftHandDetected = false;
  let rightHandDetected = false;

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.2,
    minTrackingConfidence: 0.2
  });

  hands.onResults(function(results) {
    leftHandDetected = false;
    rightHandDetected = false;
    leftGripping = false;
    rightGripping = false;

    if (results.multiHandLandmarks && results.multiHandedness) {
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const lm = results.multiHandLandmarks[i];
        const label = results.multiHandedness[i].label;
        const gripping = checkGrip(lm);

        if (label === 'Right') {
          rightHandDetected = true;
          rightGripping = gripping;
        } else {
          leftHandDetected = true;
          leftGripping = gripping;
        }
      }
    }
  });

  pose.onResults(function(results) {
    if (goalReached) {
      return;
    }
    const lm = results.poseLandmarks;
    if (!lm || lm.length < 17) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      feedback.textContent = 'No pose detected';
      feedback.className = 'feedback neutral';
      rightAngleEl.textContent = '--'; rightAngleEl.className = 'value neutral';
      leftAngleEl.textContent  = '--'; leftAngleEl.className  = 'value neutral';
      perfectDisplay.textContent = arms.right.perfectCount + arms.left.perfectCount;
      partialDisplay.textContent = arms.right.partialCount + arms.left.partialCount;
      return;
    }

    updateGripUI();

    const gripFeedbackShown = updateFeedback(arms.right, RIGHT) || updateFeedback(arms.left, LEFT);

    processArm(lm, RIGHT, arms.right, RIGHT);
    processArm(lm, LEFT,  arms.left,  LEFT);

    updateUI(rightAngleEl, arms.right);
    updateUI(leftAngleEl,  arms.left);
    perfectDisplay.textContent = arms.right.perfectCount + arms.left.perfectCount;
    partialDisplay.textContent = arms.right.partialCount + arms.left.partialCount;

    drawLandmarks(lm, canvas.width, canvas.height);

    if (arms.right.angle === 0 && arms.left.angle === 0) {
      if (!gripFeedbackShown) {
        feedback.textContent = 'Show full arm (shoulder to wrist)';
        feedback.className = 'feedback neutral';
      }
    } else if (!gripFeedbackShown && (feedback.textContent === 'Loading camera...' || feedback.textContent === 'No pose detected')) {
      feedback.textContent = 'Keep curling!';
      feedback.className = 'feedback neutral';
    }
  });

  function updateGoalDisplay() {
    if (workoutMode === 'goal' && !goalReached) {
      goalProgress.hidden = false;
      goalProgress.textContent = repCount + ' / ' + goalReps;
    }
  }

  function checkGoalReached() {
    if (workoutMode === 'goal' && !goalReached && repCount >= goalReps) {
      goalReached = true;
      saveBestScore(goalReps);
      stopCamera();
      celebrationGoal.textContent = goalReps;
      celebrationCompleted.textContent = Math.round(repCount);
      celebrationBestValue.textContent = getBestScore();

      const reviewSection = document.getElementById('reviewSection');
      const reviewGrid = document.getElementById('reviewGrid');
      reviewGrid.innerHTML = '';
      if (wrongRepScreenshots.length > 0) {
        reviewSection.style.display = '';
        wrongRepScreenshots.forEach(function(src) {
          const img = document.createElement('img');
          img.src = src;
          img.alt = 'Partial rep';
          reviewGrid.appendChild(img);
        });
      } else {
        reviewSection.style.display = 'none';
      }

      celebrationOverlay.style.display = '';
      spawnConfetti();
      playSound(880, 0.4, 'square');
      playSound(1108.73, 0.4, 'square');
      goalProgress.textContent = 'GOAL REACHED!';
      goalProgress.style.color = '#ffd93d';
    }
  }

  function startCamera() {
    camera = new Camera(video, {
      onFrame: async function() {
        if (goalReached) return;
        try { await pose.send({ image: video }); } catch(e) {}
        try { await hands.send({ image: video }); } catch(e) {}
      },
      width: 640,
      height: 480
    });
    camera.start().then(function() {
      feedback.textContent = 'Stand in front of camera';
      feedback.className = 'feedback neutral';
    }).catch(function(err) {
      feedback.textContent = 'Camera access denied. Allow camera permissions.';
      feedback.className = 'feedback neutral';
    });
  }

  // ===== CHALLENGE FUNCTIONS =====
  function parseChallengeParams() {
    var params = new URLSearchParams(window.location.search);
    if (params.has('challenge')) {
      challengerScore = parseInt(params.get('challenge'), 10) || 0;
      challengerName = params.get('name') || 'A friend';
      challengerBadReps = parseInt(params.get('badReps'), 10) || 0;
      return true;
    }
    return false;
  }

  function hideAllChallengeOverlays() {
    namePromptOverlay.style.display = 'none';
    challengeIntroOverlay.style.display = 'none';
    shareOverlay.style.display = 'none';
    resultOverlay.style.display = 'none';
  }

  function showChallengeIntro() {
    modalOverlay.style.display = 'none';
    challengeIntroOverlay.style.display = 'flex';
    challengeIntroTitle.textContent = challengerName + ' challenged you!';
    var badRepText = challengerBadReps > 0 ? ' (' + challengerBadReps + ' bad reps)' : '';
    challengeIntroText.textContent = 'Score to beat: ' + challengerScore + ' perfect reps' + badRepText + '! Can you do it? 💪';
    friendNameInput.value = '';
    friendNameInput.focus();
  }

  function startChallengerFlow() {
    challengeMode = true;
    isChallenger = true;
    workoutMode = 'challenge';
    wrongRepScreenshots = [];
    challengeBadRepCount = 0;
    challengeFinished = false;
    hideAllChallengeOverlays();
    modalOverlay.style.display = 'none';
    finishChallengeBtn.style.display = '';
    fb('Go till failure, then press Finish!', 'neutral');
    startCamera();
  }

  function startFriendFlow(name) {
    challengeMode = true;
    isChallenger = false;
    playerName = name;
    workoutMode = 'challenge';
    wrongRepScreenshots = [];
    challengeBadRepCount = 0;
    challengeFinished = false;
    hideAllChallengeOverlays();
    finishChallengeBtn.style.display = '';
    fb('Beat ' + challengerScore + ' reps, then press Finish!', 'neutral');
    startCamera();
  }

  function fb(msg, cls) {
    feedback.textContent = msg;
    feedback.className = 'feedback ' + cls;
  }

  function finishChallenge() {
    if (challengeFinished) return;
    challengeFinished = true;
    stopCamera();
    finishChallengeBtn.style.display = 'none';

    var perfectScore = arms.right.perfectCount + arms.left.perfectCount;
    challengeBadRepCount = arms.right.partialCount + arms.left.partialCount;

    if (isChallenger) {
      showShareScreen(perfectScore);
    } else {
      showResultScreen(perfectScore);
    }
  }

  function showShareScreen(score) {
    shareOverlay.style.display = 'flex';
    shareScoreText.textContent = 'You did ' + score + ' perfect reps' + (challengeBadRepCount > 0 ? ' (' + challengeBadRepCount + ' bad reps)' : '') + '!';

    var base = window.location.origin + window.location.pathname;
    var link = base + '?challenge=' + score + '&name=' + encodeURIComponent(playerName || 'Me') + '&badReps=' + challengeBadRepCount;
    challengeLink.value = link;

    if (wrongRepScreenshots.length > 0) {
      shareBadRepsSection.style.display = '';
      shareBadRepsGrid.innerHTML = '';
      for (var i = 0; i < wrongRepScreenshots.length; i++) {
        var img = document.createElement('img');
        img.src = wrongRepScreenshots[i];
        img.alt = 'Bad rep';
        shareBadRepsGrid.appendChild(img);
      }
    } else {
      shareBadRepsSection.style.display = 'none';
    }
  }

  function showResultScreen(myScore) {
    resultOverlay.style.display = 'flex';

    resultChallengerName.textContent = challengerName;
    resultChallengerScore.textContent = challengerScore;
    resultChallengerBadReps.textContent = challengerBadReps > 0 ? challengerBadReps + ' bad reps' : '';

    resultMyName.textContent = playerName;
    resultMyScore.textContent = myScore;
    resultMyBadReps.textContent = challengeBadRepCount > 0 ? challengeBadRepCount + ' bad reps' : '';

    if (wrongRepScreenshots.length > 0) {
      resultBadRepsSection.style.display = '';
      resultBadRepsGrid.innerHTML = '';
      for (var i = 0; i < wrongRepScreenshots.length; i++) {
        var img = document.createElement('img');
        img.src = wrongRepScreenshots[i];
        img.alt = 'Bad rep';
        resultBadRepsGrid.appendChild(img);
      }
    } else {
      resultBadRepsSection.style.display = 'none';
    }

    if (myScore > challengerScore) {
      winnerDisplay.style.display = '';
      winnerText.textContent = playerName + ' wins! 🏆';
      suddenDeathSection.style.display = 'none';
    } else if (myScore < challengerScore) {
      winnerDisplay.style.display = '';
      winnerText.textContent = challengerName + ' wins! 🏆';
      suddenDeathSection.style.display = 'none';
    } else {
      winnerDisplay.style.display = 'none';
      suddenDeathSection.style.display = '';
    }
  }

  function startSuddenDeath() {
    hideAllChallengeOverlays();
    wrongRepScreenshots = [];
    challengeBadRepCount = 0;
    challengeFinished = false;

    arms.right = createArmState();
    arms.left = createArmState();
    repCount = 0;
    countDisplay.textContent = '0';
    perfectDisplay.textContent = '0';
    partialDisplay.textContent = '0';
    goalProgress.hidden = true;
    rightAngleEl.textContent = '--';
    rightAngleEl.className = 'value neutral';
    leftAngleEl.textContent = '--';
    leftAngleEl.className = 'value neutral';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    finishChallengeBtn.style.display = '';
    fb('Sudden death! Beat ' + challengerScore + '! 💀', 'neutral');
    startCamera();
  }

  function copyText(text, btn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        var orig = btn.textContent;
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(function() { btn.textContent = orig; btn.classList.remove('copied'); }, 2000);
      }).catch(function() {});
    } else {
      challengeLink.select();
      document.execCommand('copy');
    }
  }

  function cleanupChallenge() {
    challengeMode = false;
    isChallenger = false;
    playerName = '';
    challengerName = '';
    challengerScore = 0;
    challengerBadReps = 0;
    challengeBadRepCount = 0;
    challengeFinished = false;
    wrongRepScreenshots = [];
    hideAllChallengeOverlays();

    arms.right = createArmState();
    arms.left = createArmState();
    repCount = 0;
    countDisplay.textContent = '0';
    perfectDisplay.textContent = '0';
    partialDisplay.textContent = '0';
    goalProgress.hidden = true;
    goalProgress.style.color = '#4ecca3';
    rightAngleEl.textContent = '--';
    rightAngleEl.className = 'value neutral';
    leftAngleEl.textContent = '--';
    leftAngleEl.className = 'value neutral';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    setGoalBtn.style.display = '';
    goFailureBtn.style.display = '';
    challengeFriendBtn.style.display = '';
    goalInputWrapper.hidden = true;
    goalInput.value = '10';
    modalOverlay.style.display = '';

    if (window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    fb('Loading camera...', 'neutral');
  }

  // ===== EVENT LISTENERS =====

  setGoalBtn.addEventListener('click', function() {
    setGoalBtn.style.display = 'none';
    goFailureBtn.style.display = 'none';
    goalInputWrapper.hidden = false;
    goalInput.focus();
  });

  startGoalBtn.addEventListener('click', function() {
    const val = parseInt(goalInput.value, 10);
    if (!val || val < 1) {
      goalInput.style.borderColor = '#e94560';
      return;
    }
    workoutMode = 'goal';
    goalReps = val;
    wrongRepScreenshots = [];
    modalOverlay.style.display = 'none';
    startCamera();
  });

  goalInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') startGoalBtn.click();
  });

  goFailureBtn.addEventListener('click', function() {
    workoutMode = 'failure';
    wrongRepScreenshots = [];
    modalOverlay.style.display = 'none';
    startCamera();
  });

  newWorkoutBtn.addEventListener('click', function() {
    celebrationOverlay.style.display = 'none';
    confettiContainer.innerHTML = '';
    goalReached = false;
    repCount = 0;
    wrongRepScreenshots = [];
    workoutMode = null;
    goalReps = 0;
    countDisplay.textContent = '0';
    perfectDisplay.textContent = '0';
    partialDisplay.textContent = '0';
    goalProgress.hidden = true;
    goalProgress.style.color = '#4ecca3';
    arms.right = createArmState();
    arms.left = createArmState();
    rightAngleEl.textContent = '--'; rightAngleEl.className = 'value neutral';
    leftAngleEl.textContent  = '--'; leftAngleEl.className  = 'value neutral';
    feedback.textContent = 'Loading camera...';
    feedback.className = 'feedback neutral';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setGoalBtn.style.display = '';
    goFailureBtn.style.display = '';
    goalInputWrapper.hidden = true;
    goalInput.value = '10';
    modalOverlay.style.display = '';
  });

  resetBtn.addEventListener('click', function() {
    repCount = 0;
    wrongRepScreenshots = [];
    goalReached = false;
    if (workoutMode === 'goal') {
      goalProgress.hidden = false;
      goalProgress.style.color = '#4ecca3';
      goalProgress.textContent = '0 / ' + goalReps;
    }
    if (workoutMode === 'challenge') {
      challengeBadRepCount = 0;
    }
    countDisplay.textContent = '0';
    perfectDisplay.textContent = '0';
    partialDisplay.textContent = '0';
    arms.right = createArmState();
    arms.left = createArmState();
    rightAngleEl.textContent = '--'; rightAngleEl.className = 'value neutral';
    leftAngleEl.textContent  = '--'; leftAngleEl.className  = 'value neutral';
    feedback.textContent = 'Reset!';
    feedback.className = 'feedback neutral';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  // ===== CHALLENGE EVENT LISTENERS =====

  challengeFriendBtn.addEventListener('click', function() {
    modalOverlay.style.display = 'none';
    namePromptOverlay.style.display = 'flex';
    challengerNameInput.value = '';
    challengerNameInput.focus();
  });

  startChallengeBtn.addEventListener('click', function() {
    var name = challengerNameInput.value.trim();
    if (!name) {
      challengerNameInput.style.borderColor = '#e94560';
      return;
    }
    challengerNameInput.style.borderColor = '';
    playerName = name;
    startChallengerFlow();
  });

  challengerNameInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') startChallengeBtn.click();
  });

  acceptChallengeBtn.addEventListener('click', function() {
    var name = friendNameInput.value.trim();
    if (!name) {
      friendNameInput.style.borderColor = '#e94560';
      return;
    }
    friendNameInput.style.borderColor = '';
    startFriendFlow(name);
  });

  friendNameInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') acceptChallengeBtn.click();
  });

  finishChallengeBtn.addEventListener('click', finishChallenge);

  copyLinkBtn.addEventListener('click', function() {
    copyText(challengeLink.value, copyLinkBtn);
  });

  shareDoneBtn.addEventListener('click', cleanupChallenge);

  suddenDeathBtn.addEventListener('click', startSuddenDeath);

  resultShareBtn.addEventListener('click', function() {
    var cName = resultChallengerName.textContent;
    var cScore = resultChallengerScore.textContent;
    var cBad = resultChallengerBadReps.textContent;
    var mName = resultMyName.textContent;
    var mScore = resultMyScore.textContent;
    var mBad = resultMyBadReps.textContent;
    var wText = winnerDisplay.style.display !== 'none' ? winnerText.textContent : 'It\'s a tie!';
    var resultText = '🏋️ Bicep Curl Challenge Result!\n' + cName + ': ' + cScore + ' perfect reps' + (cBad ? ' (' + cBad + ')' : '') + '\n' + mName + ': ' + mScore + ' perfect reps' + (mBad ? ' (' + mBad + ')' : '') + '\n' + wText;
    copyText(resultText, resultShareBtn);
  });

  resultDoneBtn.addEventListener('click', cleanupChallenge);

  // ===== URL PARAMS CHECK =====
  if (parseChallengeParams()) {
    challengeMode = true;
    isChallenger = false;
    showChallengeIntro();
  }

})();
