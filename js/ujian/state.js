var CURRENT_USER = null;

var EXAM_SESSION_ALERT_USE_REALTIME = true;

var EXAM_SESSION_ALERT_FALLBACK_MS = 15000;
var EXAM_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
var EXAM_STATE = { schedule: null, currentIndex: 0, answers: {}, doubts: {}, scrambledQuestions: [], scrambledOptions: {}, timeRemaining: 0, timerInterval: null, cheatTabCount: 0, cheatFocusCount: 0, splitScreenDetected: false };
var unsubscribeSessionAlert = null;
var currentStudentAlertId = null;
var idleLastActiveMs = Date.now();
var idleCheckInterval = null;
var idleBound = false;
var examOrientationBaseline = null;
var SPLIT_SCREEN_SUBMIT_MS = 5000;
var splitScreenTimer = null;
var splitScreenCountdownInterval = null;
var splitScreenBaseline = null;
var splitScreenSecondsLeft = 5;
var examViolationLastAt = 0;
