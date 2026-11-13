// საჯარო API-ს მისამართი (Open Trivia DB - აბრუნებს 10 მრავალარჩევანიან კითხვას)
const API_URL = "https://opentdb.com/api.php?amount=10&type=multiple";

// გლობალური ცვლადები ვიქტორინის მდგომარეობისთვის
let quizData = [];
let currentQuestionIndex = 0;
let score = 0;
let correctCount = 0;
let answered = false;

const POINTS_PER_QUESTION = 5; // თითო სწორი პასუხი = 5 ქულა

// DOM ელემენტების შერჩევა
const quizCard = document.getElementById("quiz-card");
const resultCard = document.getElementById("result-card");
const scoreFooter = document.getElementById("score-footer");

const questionCounter = document.getElementById("question-counter");
const progressPercent = document.getElementById("progress-percent");
const progressBar = document.getElementById("progress-bar");
const questionText = document.getElementById("question-text");
const optionsContainer = document.getElementById("options-container");
const nextBtn = document.getElementById("next-btn");

const currentScoreEl = document.getElementById("current-score");
const finalScoreEl = document.getElementById("final-score");
const correctAnswersSummary = document.getElementById("correct-answers-summary");
const resultMessage = document.getElementById("result-message");
const restartBtn = document.getElementById("restart-btn");

/**
 * დამხმარე ფუნქცია: HTML სიმბოლოების დეკოდირებისთვის 
 * (რადგან API ზოგჯერ აბრუნებს ტექსტებს სპეციალური კოდებით, მაგ: &quot;)
 */
function decodeHTML(html) {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
}

/**
 * დამხმარე ფუნქცია: მასივის ელემენტების ასარევად (Fisher-Yates ალგორითმი), 
 * რომ სწორი პასუხი ყოველთვის ერთსა და იმავე ადგილზე არ იყოს.
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * ფეიერვერკის (Confetti) გაშვება სწორი პასუხის შემთხვევაში
 */
function triggerFireworks() {
    if (typeof confetti === "function") {
        confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#34d399', '#818cf8', '#f472b6', '#fbbf24']
        });
    }
}

/**
 * დიდი ფეიერვერკი ქვიზის წარმატებით დასრულებისას
 */
function triggerFinalFireworks() {
    if (typeof confetti !== "function") return;
    const duration = 2000;
    const end = Date.now() + duration;

    (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}

/**
 * 1. ASYNC/AWAIT და FETCH: მონაცემების წამოღება საჯარო API-დან try/catch ბლოკით
 */
async function fetchQuizData() {
    try {
        // სანამ მონაცემები იტვირთება, ვანახებთ ლოდინის ინდიკატორს
        questionText.textContent = "მონაცემები იტვირთება API-დან...";
        optionsContainer.innerHTML = `
            <div class="flex justify-center items-center py-10">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
            </div>
        `;

        const response = await fetch(API_URL);

        // შევამოწმოთ სერვერის პასუხი
        if (!response.ok) {
            throw new Error(`ქსელის შეცდომა: სერვერის სტატუსი ${response.status}`);
        }

        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            throw new Error("API-მ ცარიელი მონაცემები დააბრუნა.");
        }

        // API-ის შედეგების გარდაქმნა ჩვენთვის სასურველ ფორმატში
        quizData = data.results.map(item => {
            const incorrects = item.incorrect_answers.map(ans => decodeHTML(ans));
            const correct = decodeHTML(item.correct_answer);
            
            // ვურევთ არასწორ და სწორ პასუხებს ერთად
            const allOptions = shuffleArray([...incorrects, correct]);
            const correctIndex = allOptions.indexOf(correct);

            return {
                question: decodeHTML(item.question),
                options: allOptions,
                correct: correctIndex
            };
        });

        // მონაცემების წარმატებით წამოღების შემდეგ ვათავისუფლებთ და ვიწყებთ ქვიზს
        currentQuestionIndex = 0;
        score = 0;
        correctCount = 0;
        currentScoreEl.textContent = score;
        loadQuestion();

    } catch (error) {
        // შეცდომების დაჭერა try/catch ბლოკში
        console.error("შეცდომა კითხვების წამოღებისას:", error);
        questionText.textContent = "⚠️ კითხვების ჩატვირთვა ვერ მოხერხდა. გთხოვთ შეამოწმოთ ინტერნეტ კავშირი.";
        optionsContainer.innerHTML = `
            <button onclick="fetchQuizData()" class="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg transition-all">
                თავიდან ცდა ↻
            </button>
        `;
    }
}

/**
 * 2. DOM მანიპულაცია: კითხვისა და ვარიანტების ეკრანზე გამოტანა
 */
function loadQuestion() {
    answered = false;
    nextBtn.classList.add("hidden");
    optionsContainer.innerHTML = "";

    const currentData = quizData[currentQuestionIndex];
    const totalQuestions = quizData.length;

    // პროგრესის ზოლისა და ნომრის განახლება
    const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;
    questionCounter.textContent = `კითხვა ${currentQuestionIndex + 1} / ${totalQuestions}`;
    progressPercent.textContent = `${Math.round(progress)}%`;
    progressBar.style.width = `${progress}%`;

    // textContent-ის გამოყენებით კითხვის ჩასმა
    questionText.textContent = currentData.question;

    // 4 სავარაუდო პასუხის გენერაცია createElement-ის გამოყენებით
    const letters = ["A", "B", "C", "D"];
    currentData.options.forEach((optionText, index) => {
        const button = document.createElement("button");
        button.className = `
            w-full text-left p-4 rounded-xl border border-slate-700 bg-slate-900/60 
            hover:bg-slate-700/70 hover:border-indigo-500/50 
            transition-all duration-200 flex items-center gap-3 group cursor-pointer
        `;

        const badgeSpan = document.createElement("span");
        badgeSpan.className = "w-8 h-8 rounded-lg bg-slate-800 border border-slate-600 flex items-center justify-center text-sm font-bold text-slate-300 group-hover:border-indigo-400 group-hover:text-indigo-300 transition-colors";
        badgeSpan.textContent = letters[index];

        const textSpan = document.createElement("span");
        textSpan.className = "font-medium text-slate-200";
        textSpan.textContent = optionText;

        button.appendChild(badgeSpan);
        button.appendChild(textSpan);

        // 3. addEventListener ღილაკზე პასუხის ასარჩევად
        button.addEventListener("click", () => selectAnswer(index, button));
        optionsContainer.appendChild(button);
    });
}

/**
 * პასუხის არჩევის ლოგიკა (მწვანე/წითელი ფერები, ქულების დამატება, ფეიერვერკი)
 */
function selectAnswer(selectedIndex, selectedButton) {
    if (answered) return;
    answered = true;

    const currentData = quizData[currentQuestionIndex];
    const correctIndex = currentData.correct;
    const allButtons = optionsContainer.querySelectorAll("button");

    // ყველა ღილაკის გათიშვა ერთხელ დაჭერის შემდეგ
    allButtons.forEach(btn => {
        btn.disabled = true;
        btn.classList.remove("hover:bg-slate-700/70", "hover:border-indigo-500/50", "cursor-pointer");
        btn.classList.add("cursor-default");
    });

    if (selectedIndex === correctIndex) {
        // სწორი პასუხი -> გამწვანება, ქულის დამატება და ფეიერვერკი
        styleButtonCorrect(selectedButton);
        score += POINTS_PER_QUESTION;
        correctCount++;
        currentScoreEl.textContent = score;
        triggerFireworks();
    } else {
        // არასწორი პასუხი -> არჩეულის გაწითლება და სწორის გამწვანება
        styleButtonWrong(selectedButton);
        styleButtonCorrect(allButtons[correctIndex]);
    }

    // ტექსტის შეცვლა ღილაკზე ბოლო კითხვისას
    if (currentQuestionIndex === quizData.length - 1) {
        nextBtn.textContent = "შედეგის ნახვა 🎉";
    } else {
        nextBtn.textContent = "შემდეგი კითხვა →";
    }

    nextBtn.classList.remove("hidden");
}

/**
 * ღილაკის სტილიზაცია სწორი პასუხის შემთხვევაში (მწვანე)
 */
function styleButtonCorrect(button) {
    button.classList.remove("bg-slate-900/60", "border-slate-700");
    button.classList.add("bg-emerald-600/25", "border-emerald-500", "text-emerald-100", "shadow-lg", "shadow-emerald-500/10");
    const badge = button.querySelector("span");
    if (badge) {
        badge.classList.remove("bg-slate-800", "border-slate-600", "text-slate-300");
        badge.classList.add("bg-emerald-500", "border-emerald-400", "text-slate-950");
    }
}

/**
 * ღილაკის სტილიზაცია არასწორი პასუხის შემთხვევაში (წითელი)
 */
function styleButtonWrong(button) {
    button.classList.remove("bg-slate-900/60", "border-slate-700");
    button.classList.add("bg-rose-600/25", "border-rose-500", "text-rose-100");
    const badge = button.querySelector("span");
    if (badge) {
        badge.classList.remove("bg-slate-800", "border-slate-600", "text-slate-300");
        badge.classList.add("bg-rose-500", "border-rose-400", "text-white");
    }
}

// addEventListener "შემდეგი კითხვის" ღილაკისთვის
nextBtn.addEventListener("click", () => {
    currentQuestionIndex++;
    if (currentQuestionIndex < quizData.length) {
        loadQuestion();
    } else {
        showResults();
    }
});

/**
 * საბოლოო შედეგების ბარათის გამოჩენა
 */
function showResults() {
    quizCard.classList.add("hidden");
    scoreFooter.classList.add("hidden");
    resultCard.classList.remove("hidden");

    finalScoreEl.textContent = score;
    correctAnswersSummary.textContent = `სწორი პასუხი: ${correctCount} / ${quizData.length}`;

    if (score >= 40) {
        resultMessage.textContent = "ბრავო! შესანიშნავი შედეგი!";
        triggerFinalFireworks();
    } else if (score >= 25) {
        resultMessage.textContent = "კარგი შედეგია! ცოტაც და მაქსიმუმს მიაღწევ.";
        triggerFireworks();
    } else {
        resultMessage.textContent = "ცუდი არ არის, სცადე თავიდან შედეგის გასაუმჯობესებლად!";
    }
}

// addEventListener "თავიდან დაწყების" ღილაკისთვის
restartBtn.addEventListener("click", () => {
    resultCard.classList.add("hidden");
    quizCard.classList.remove("hidden");
    scoreFooter.classList.remove("hidden");
    fetchQuizData(); // ახალი კითხვების წამოღება API-დან ხელახლა თამაშისთვის
});

// აპლიკაციის საწყისი ინიციალიზაცია (მონაცემების ჩამოტვირთვა გვერდის გახსნისთანავე)
fetchQuizData();