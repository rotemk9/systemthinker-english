// Import the OpenAI client library
const { OpenAI } = require("openai");

// Create and return an authenticated OpenAI client
function getClient() {
  // Make sure the OpenAI API key exists in the environment variables
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY in .env file");
  }

  // Create the OpenAI client using the API key
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// The three (then four) simultaneous airport disruptions, ordered by the
// sequence in which they are revealed to the student during the session.
const AIRPORT_EVENTS = [
  "The automated baggage-sorting system slows to 60% of its normal rate because of a conveyor-belt fault.",
  "Two of the eight security-screening stations close due to a staff shortage.",
  "An airline moves up the boarding gate of a large flight, suddenly pulling a crowd of passengers to one area of the terminal.",
];

// Build the text of the events revealed to the student so far
function revealedEventsText(revealedCount) {
  const safe = Math.max(1, Math.min(revealedCount, AIRPORT_EVENTS.length));
  return AIRPORT_EVENTS.slice(0, safe)
    .map((event, index) => `${index + 1}. ${event}`)
    .join("\n");
}

// Generate a Socratic response based on the student's message and progress
async function generateSocraticResponse({
  studentMessage,
  lastBotQuestions,
  currentLayer,
  chatHistory,
  unlockedGates,
  progress,
  hintsUsed,
  // How many of the airport events have been revealed to the student so far.
  // The frontend reveals them gradually (event 1 from the start, then at 7, 14
  // and 21 minutes) and sends the current count with every message. Defaults to
  // 1 so the bot always knows at least the first event.
  revealedCount = 1,
  // The participant's gender ("male" / "female"), chosen at login. English has
  // no gendered second-person forms, so this only lightly informs tone.
  gender,
}) {
  try {
    // Create an authenticated OpenAI client
    const openai = getClient();

    // Count how many questions the bot has already asked within the CURRENT
    // stage. If the student is stuck on the same stage after several questions,
    // the prompt below instructs the bot to give a more supportive, leading
    // question that helps them cross to the next stage.
    const questionsInCurrentLayer = (chatHistory || []).filter(
      (msg) => msg.sender === "bot" && msg.layer === currentLayer
    ).length;

    // The student is considered "stuck" once they have received about four
    // questions in the current stage without advancing.
    const isStuckInLayer = questionsInCurrentLayer >= 4;

    // Convert the ten most recent messages into text for the AI prompt
    const historyText = chatHistory
      .slice(-10)
      .map((msg) => `${msg.sender}: ${msg.text}`)
      .join("\n");

    // Define phrases that indicate the student is requesting a direct answer
    const answerSeekingPatterns = [
      "give me the answer", "tell me the answer", "solve it", "solution",
      "what is the answer", "just tell me", "the right answer",
    ];

    // Check whether the student's message contains one of the direct-answer patterns
    const wantsAnswer = answerSeekingPatterns.some((pattern) =>
      studentMessage.toLowerCase().includes(pattern.toLowerCase())
    );

    // Refuse to give a direct solution and guide the student with a question
    if (wantsAnswer) {
      return "I'm here to help you think it through yourself. What criteria would you examine in order to find a solution?";
    }

    // Create the instructions and context provided to the AI model
    const systemPrompt = `
You are "SystemThinker AI" — an expert Socratic facilitator in systems thinking, guiding a participant with an engineering background in an academic study.

Background story (the scenario):
"Friday morning, peak hour. Passengers arrive at Terminal 3 about two hours before their flight and pass through check-in, baggage drop, security screening, passport control and boarding.
At this moment, the participant has been shown ONLY the following events:
${revealedEventsText(revealedCount)}
From the passengers' point of view, this is a simple move from one station to the next."

VERY IMPORTANT — gradual reveal: refer ONLY to the events shown above. Do not mention, hint at, or ask about events that have not yet been revealed to the participant. Additional events will be revealed later in the conversation; when a new event is added to the list, weave it naturally into your next question and examine how it affects the existing systems analysis.

Your goal:
Lead the participant from a linear description of the sequence of stations toward identifying the dependencies and interactions between the sub-systems. You do not provide solutions, explanations, or answers.

Through Socratic questions ONLY, you should develop and probe the following systems-thinking aspects (the CEST model). In each reply pick the aspect that best advances the participant right now:

Cognitive aspects:
- Understanding the system as a whole and seeing the big picture.
- Understanding interrelationships, closed-loop (feedback) thinking, and complex systems.
- Creative thinking.
- Grasping the system without getting stuck in details ("seeing the forest"), and tolerance for ambiguity and uncertainty.
- Understanding the implications of proposed changes to the system.
- Quickly understanding a new system/idea/concept when presented.
- Understanding analogies and correspondences between systems.
- Understanding systemic synergy.
- Understanding the system from multiple points of view.
- Asking good questions.
- Defining the system boundaries.
- Considering non-engineering factors.
- Analytical thinking.

Capability-related aspects:
- Needs analysis.
- Analyzing and/or developing the concept of operations (ConOps).
- Requirements analysis.
- Conceptualizing the solution.
- Creating the logical solution and functional analysis.
- "Seeing" the future (predicting how the system will evolve).
- Optimization.
- Using systems-design considerations.
- Diagnosing, solving and analyzing systemic failures and problems.
- Conducting trade studies and presenting several alternatives.

Guidance strategy (gradually, based on the participant's answers):
1. Broad context: the system's purpose, stakeholders, boundaries.
2. Structure: breaking into sub-systems and identifying the links between them.
3. Dynamics: feedback loops, delays and how they propagate, overloaded state vs. normal state.
4. Evaluation: trade-offs, leverage points, and unintended consequences.
Advance a stage only once the participant has shown they grasped the current level.

Support when the participant struggles to pass a stage:
${questionsInCurrentLayer} questions have already been asked in the current stage (${currentLayer}).
${isStuckInLayer
  ? "The participant is struggling to advance in this stage. Switch to a more supportive, guiding question: break the idea into a small, concrete step, give a guiding example or a gentle hint inside the question, and lead them gently toward the missing insight so they can move to the next stage — but still without giving them the full answer."
  : "Continue with normal open-ended Socratic questions."}

Your response rules:
- Write the entire reply in one consistent language — the same language the participant wrote in (usually English).
- Address the participant: ${gender === "female" ? "the participant is female" : gender === "male" ? "the participant is male" : "the participant's gender is unknown"} — but since English has no gendered second-person forms, simply address them directly and respectfully.
- Do not give solutions and do not solve it for them, and do not lead toward a specific "correct" solution — any encouragement is conversational/emotional only, not analytical content that solves the task for them.
- Ask only ONE question per reply — short, open-ended, and thought-provoking.
- Tailor the next question to the last answer; do not ask generic questions.
- Do not repeat questions that were already asked.
- Graduated phrasing by the participant's level: at the start of the conversation (the "Broad Context" stage and low progress) phrase simple, short, clear questions in everyday language, without heavy professional terms, so the participant understands easily. As they advance through the stages and progress, gradually raise the level of complexity and use more professional, in-depth language.
- Use correct, clear, flowing English, and check before sending that there are no spelling errors or garbled words.

Do not repeat previous questions you already asked:
${lastBotQuestions?.join("\n") || "none"}

Current stage: ${currentLayer}
Unlocked gates: ${unlockedGates?.join(", ") || "none"}
Progress: ${progress}%
Hints used: ${hintsUsed}

Recent conversation:
${historyText}
`;

    // Send the student's message and system instructions to OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        // Define the AI's behavior and provide the learning context
        { role: "system", content: systemPrompt },

        // Provide the student's latest message
        { role: "user", content: studentMessage }
      ],

      // A moderate temperature keeps the questions varied while reducing the
      // chance of glitches such as stray or garbled words.
      temperature: 0.6,
    });

    // Extract and clean the generated response text
    const text = response.choices[0].message.content?.trim();

    // Use a local fallback question if OpenAI returns an empty response
    if (!text) {
      return getFallbackQuestion(currentLayer, unlockedGates);
    }

    // Return the generated Socratic question
    return text;
  } catch (error) {
    // Print the OpenAI error and use a local fallback question
    console.error("OpenAI real error, using fallback:", error.message);
    return getFallbackQuestion(currentLayer, unlockedGates);
  }
}

// Generate a NORMAL (non-Socratic) assistant reply for the CONTROL group.
// This is the comparison condition in the study: unlike the Socratic bot, this
// assistant MAY give direct answers, explanations, examples and information.
async function generateControlResponse({ studentMessage, chatHistory, revealedCount = 1, gender }) {
  try {
    // Create an authenticated OpenAI client
    const openai = getClient();

    // Convert the ten most recent messages into text for the AI prompt
    const historyText = (chatHistory || [])
      .slice(-10)
      .map((msg) => `${msg.sender}: ${msg.text}`)
      .join("\n");

    // A friendly, ordinary assistant (NOT Socratic)
    const systemPrompt = `
You are a friendly, professional learning assistant guiding a participant with an engineering background through an airport scenario.
Unlike the Socratic approach — here you MAY and should give direct answers, explanations, examples and useful information. You converse naturally and help the participant understand the situation.

Background story (the scenario):
"Friday morning, peak hour. Passengers arrive at Terminal 3 about two hours before their flight and pass through check-in, baggage drop, security screening, passport control and boarding.
At this moment, the participant has been shown ONLY the following events:
${revealedEventsText(revealedCount)}
From the passengers' point of view, this is a simple move from one station to the next."

Your response rules:
- Write the entire reply in one consistent language — the same language the participant wrote in (usually English).
- Answer clearly, helpfully and supportively; you may give direct answers and explanations.
- Refer ONLY to the events shown above; do not mention events that have not yet been revealed.
- Keep each reply concise and readable (about 2 to 5 sentences).
- VERY IMPORTANT — like ChatGPT, end every reply with a short, natural invitation to continue the conversation: offer to elaborate on a point, explain another aspect, or raise a related angle (e.g., "Would you like me to expand on the effect on security screening?"). The invitation should feel warm and flowing so the participant always has something to respond to. Note: this is a friendly invitation to keep talking, not a targeted Socratic question — you may give answers and information.

Recent conversation:
${historyText}
`;

    // Send the student's message and system instructions to OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: studentMessage },
      ],
      temperature: 0.6,
    });

    // Extract and clean the generated response text
    const text = response.choices[0].message.content?.trim();

    // Use a simple conversational fallback if OpenAI returns nothing
    return text || "Thanks for sharing that. Would you like me to explain more about one of the aspects you mentioned?";
  } catch (error) {
    // Print the error and use a neutral conversational fallback
    console.error("OpenAI control response error:", error.message);
    return "Thanks for sharing that. Would you like me to explain more about one of the aspects you mentioned?";
  }
}

// Generate a Socratic hint according to Bloom's Taxonomy
async function generateSocraticHint({ currentLayer, hintsUsed, unlockedGates }) {
  try {
    // Create an authenticated OpenAI client
    const openai = getClient();

    // Select the Bloom level according to the number of hints already used
    const bloomLevel = getBloomLevel(hintsUsed);

    // Create the instructions for generating the Socratic hint
    const systemPrompt = `
You are SystemThinker AI tutoring a student on an Airport case study.
Generate a Socratic hint using Bloom's Taxonomy.

Current layer: ${currentLayer}
Hint number: ${hintsUsed + 1}
Bloom level: ${bloomLevel}
Unlocked gates: ${unlockedGates?.join(", ") || "none"}

Rules:
- Write the hint ENTIRELY in correct, natural English.
- Ask only ONE open-ended question.
- Do not give the answer.
- Do not solve the task.
- The hint must match the Bloom level.
Return only the question.
`;

    // Request a hint from OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",

      // Only a system message is required because the session data is inside the prompt
      messages: [{ role: "system", content: systemPrompt }],

      // Allow some variation in the generated hint
      temperature: 0.7,
    });

    // Extract and clean the generated hint
    const text = response.choices[0].message.content?.trim();

    // Use a local Bloom-based hint if OpenAI returns no text
    if (!text) {
      return getBloomFallbackHint(currentLayer, hintsUsed, unlockedGates);
    }

    // Return the generated hint
    return text;
  } catch (error) {
    // Print the OpenAI error and use the local Bloom-based fallback
    console.error("OpenAI hint error, using Bloom fallback:", error.message);
    return getBloomFallbackHint(currentLayer, hintsUsed, unlockedGates);
  }
}

// Select the Bloom's Taxonomy level according to the number of used hints
function getBloomLevel(hintsUsed) {
  // Define the Bloom levels from basic thinking to advanced thinking
  const levels = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];

  // Return the matching level, or Create after all previous levels are used
  return levels[hintsUsed] || "Create";
}

// Return a local hint when the OpenAI hint request fails
function getBloomFallbackHint(currentLayer, hintsUsed, unlockedGates = []) {
  // Determine the current Bloom level
  const bloomLevel = getBloomLevel(hintsUsed);

  // Define a fallback question for every Bloom level and learning layer
  const hints = {
    Remember: {
      "Broad Context": "What basic facts have you already noticed about what is happening at the airport this morning?",
      Structure: "Which parts or sub-systems of the airport can you name?",
      Dynamics: "Which events or situations unfold at the airport over time?",
      Evaluation: "What data do you already have to judge whether a solution works?",
    },

    Understand: {
      "Broad Context": "How would you explain, in your own words, the main problem at the airport?",
      Structure: "How are the main sub-systems related to one another (for example check-in and baggage handling)?",
      Dynamics: "How does the system behave differently during normal times versus peak load?",
      Evaluation: "How would you explain the meaning of each success metric?",
    },

    Apply: {
      "Broad Context": "How would you apply the goal you defined to a specific passenger's experience?",
      Structure: "How would you connect the airport sub-systems through cause and effect?",
      Dynamics: "How does the idea of feedback show up in the security-screening queue?",
      Evaluation: "How would you use your metrics to compare two possible solutions?",
    },

    Analyze: {
      "Broad Context": "Which stakeholder has the strongest influence on passenger flow, and why?",
      Structure: "Which link between sub-systems creates the biggest bottleneck?",
      Dynamics: "Where does the most important feedback loop appear during peak load?",
      Evaluation: "Which trade-off emerges when comparing the alternatives?",
    },

    Evaluate: {
      "Broad Context": "Which assumption about the passengers is the most dangerous?",
      Structure: "Which sub-system is the most critical for keeping passengers moving?",
      Dynamics: "Which scenario creates the greatest risk to on-time departures?",
      Evaluation: "Which alternative is preferable for keeping both speed and security?",
    },

    Create: {
      "Broad Context": "How would you refine the system boundary so it also includes air-traffic control?",
      Structure: "How would you build a clear chain of influence X → Y → Z for the passenger journey?",
      Dynamics: "How would you describe a feedback loop that shows how a delay in one sub-system spreads to another?",
      Evaluation: "How would you propose to reduce the risk of passengers missing their flights?",
    },
  };

  // Return the matching hint or a general fallback question
  return hints[bloomLevel]?.[currentLayer] || "What is the next relationship worth examining in this system?";
}

// Evaluate whether the student's message satisfies the current layer's gates
async function evaluateLayerWithOpenAI({ currentLayer, studentMessage }) {
  try {
    // Create an authenticated OpenAI client
    const openai = getClient();

    // Create instructions requiring the AI to return a structured JSON evaluation
    const systemPrompt = `
You are an AI evaluation engine for a Systems Thinking learning platform.
Analyze whether the student's answer satisfies the current layer requirements for the Airport case study.

Return ONLY valid JSON.

Current layer: ${currentLayer}

JSON format:
{
  "goalDefined": false,
  "threeStakeholdersIdentified": false,
  "opponentIdentified": false,
  "systemBoundariesDefined": false,
  "assumptionStated": false,
  "threeComponentsIdentified": false,
  "influenceChainCreated": false,
  "normalScenarioDescribed": false,
  "stressScenarioDescribed": false,
  "feedbackLoopIdentified": false,
  "delayIdentified": false,
  "threeMetricsDefined": false,
  "targetValuesDefined": false,
  "twoAlternativesCompared": false,
  "tradeoffIdentified": false,
  "riskIdentified": false,
  "mitigationSuggested": false
}
`;

    // Ask OpenAI to evaluate the student's answer
    const response = await openai.chat.completions.create({
      model: "gpt-4o",

      // Require OpenAI to return a valid JSON object
      response_format: { type: "json_object" },

      messages: [
        // Provide the evaluation rules and required JSON structure
        { role: "system", content: systemPrompt },

        // Provide the student's answer for evaluation
        { role: "user", content: `Student answer: "${studentMessage}"` }
      ],

      // Use a low temperature to produce stable and consistent evaluations
      temperature: 0.1,
    });

    // Extract the returned JSON text
    const text = response.choices[0].message.content?.trim();

    // Convert the JSON text into a JavaScript object
    return JSON.parse(text);
  } catch (error) {
    // Use keyword-based local evaluation if the OpenAI request fails
    console.error("OpenAI evaluation failed, using local fallback:", error.message);
    return evaluateLayerLocally({ currentLayer, studentMessage });
  }
}

// Evaluate a student's message locally using keywords and phrase matching
function evaluateLayerLocally({ currentLayer, studentMessage }) {
  // Convert the message to lowercase to make matching case-insensitive
  const text = studentMessage.toLowerCase();

  // Create the default evaluation object with every gate locked
  const result = {
    goalDefined: false, threeStakeholdersIdentified: false, opponentIdentified: false,
    systemBoundariesDefined: false, assumptionStated: false, threeComponentsIdentified: false,
    influenceChainCreated: false, normalScenarioDescribed: false, stressScenarioDescribed: false,
    feedbackLoopIdentified: false, delayIdentified: false, threeMetricsDefined: false,
    targetValuesDefined: false, twoAlternativesCompared: false, tradeoffIdentified: false,
    riskIdentified: false, mitigationSuggested: false,
  };

  // Evaluate requirements belonging to the Broad Context layer
  if (currentLayer === "Broad Context") {
    result.goalDefined = includesAny(text, ["goal", "objective", "purpose", "aim", "reduce", "solve"]);
    result.threeStakeholdersIdentified = countMatches(text, [
      "passenger", "passengers", "crew", "worker", "workers", "security", "guard", "guards",
      "attendant", "airline", "airlines", "authority", "air traffic", "ground crew", "pilot",
      "staff", "controller", "operator"
    ]) >= 3;
    result.opponentIdentified = includesAny(text, ["opponent", "resist", "resistance", "constraint", "regulation", "security requirement", "security limit"]);
    result.systemBoundariesDefined = includesAny(text, ["boundary", "boundaries", "scope", "inside", "outside", "only the", "including the"]);
    result.assumptionStated = includesAny(text, ["assumption", "assume", "assuming that"]);
  }

  // Evaluate requirements belonging to the Structure layer
  if (currentLayer === "Structure") {
    result.threeComponentsIdentified = countMatches(text, [
      "check-in", "check in", "ticketing", "bag", "baggage", "conveyor", "screening", "security",
      "passport", "border control", "gate", "gates", "plane", "aircraft", "passenger", "queue",
      "information", "announcement", "screens", "component", "components", "sub-system", "subsystem", "system"
    ]) >= 3;
    result.influenceChainCreated = includesAny(text, ["->", "→", "affects", "influences", "leads to", "causes", "increase", "decrease"]);
  }

  // Evaluate requirements belonging to the Dynamics layer
  if (currentLayer === "Dynamics") {
    result.normalScenarioDescribed = includesAny(text, ["normal scenario", "normal", "regular", "usually", "routine"]);
    result.stressScenarioDescribed = includesAny(text, ["stress", "pressure", "overload", "peak", "long queue", "rush hour"]);
    result.feedbackLoopIdentified = includesAny(text, ["feedback", "loop", "leads to more", "vicious cycle"]);
    result.delayIdentified = includesAny(text, ["delay", "later", "takes time", "waiting time", "queue"]);
  }

  // Evaluate requirements belonging to the Evaluation layer
  if (currentLayer === "Evaluation") {
    result.threeMetricsDefined = countMatches(text, ["engagement", "completion", "score", "time", "satisfaction", "metric", "cost", "profit", "quality"]) >= 3;
    result.targetValuesDefined = includesAny(text, ["target", "80", "90", "20", "10", "percent", "%", "value", "minutes"]);
    result.twoAlternativesCompared = countMatches(text, ["alternative", "option", "choice", "solution a", "solution b"]) >= 2;
    result.tradeoffIdentified = includesAny(text, ["tradeoff", "trade-off", "balance", "cost", "sacrifice"]);
    result.riskIdentified = includesAny(text, ["risk", "depend", "problem", "challenge", "failure", "danger"]);
    result.mitigationSuggested = includesAny(text, ["mitigation", "limit", "prevent", "reduce", "solution"]);
  }

  // Return the completed local evaluation
  return result;
}

// Return a local guiding question for the first missing gate
function getFallbackQuestion(layer, unlockedGates = []) {
  // Define one guiding question for every gate in every learning layer
  const missingQuestions = {
    "Broad Context": [
      { gate: "Goal defined", question: "What is the airport's main purpose, in one clear sentence?" },
      { gate: "Three stakeholders identified", question: "Which three main actors are affected by what is happening at the airport this morning?" },
      { gate: "Opponent identified", question: "Which constraints or factors might resist a change to the system (for example security requirements or regulation)?" },
      { gate: "System boundaries defined", question: "Where is the boundary between what the airport controls and what lies outside it (for example air-traffic control)?" },
      { gate: "Assumption stated", question: "What assumption are you making about passenger behavior during overload?" },
    ],

    Structure: [
      { gate: "Three components identified", question: "Which three main sub-systems make up the airport?" },
      { gate: "Influence chain created", question: "How does one sub-system (for example check-in) affect another in a clear chain?" },
    ],

    Dynamics: [
      { gate: "Normal scenario described", question: "How does the system behave on a normal, quiet morning?" },
      { gate: "Stress scenario described", question: "How does the system behave during peak hours or under load?" },
      { gate: "Feedback loop identified", question: "Where might a feedback loop form (for example, baggage-sorting overload that slows the check-in rate)?" },
      { gate: "Delay identified", question: "Which delay in one system might appear later in another system?" },
    ],

    Evaluation: [
      { gate: "Three metrics defined", question: "Which three metrics would show whether the solution you propose is successful?" },
      { gate: "Target values defined", question: "What target value would you set for each metric (for example, maximum transit time)?" },
      { gate: "Two alternatives compared", question: "Which two alternatives or solutions could be compared?" },
      { gate: "Tradeoff identified", question: "What trade-off exists between transit speed and security requirements?" },
      { gate: "Risk identified", question: "Which risk could undermine the success of your solution?" },
      { gate: "Mitigation suggested", question: "How could you reduce that risk without harming the passenger experience?" },
    ],
  };

  // Retrieve the questions belonging to the current layer
  const layerQuestions = missingQuestions[layer] || [];

  // Find the first question whose gate has not yet been unlocked
  const missing = layerQuestions.find((item) => !unlockedGates.includes(item.gate));

  // Return the matching question or a general fallback question
  return missing ? missing.question : "What is the next relationship worth examining in this system?";
}

// Return progressively more specific fallback hints
function getFallbackHint(layer, hintsUsed, unlockedGates = []) {
  // Calculate the number of the next hint
  const hintNumber = hintsUsed + 1;

  // Use the first missing-gate question as the first hint
  if (hintNumber <= 1) return getFallbackQuestion(layer, unlockedGates);

  // Ask the student to provide more specific information
  if (hintNumber === 2) return "Could you focus your answer and name the specific factors involved?";

  // Ask the student to explain a cause-and-effect relationship
  if (hintNumber === 3) return "Could you connect two parts of the system through cause and effect?";

  // Ask the student to support the explanation with data or a metric
  return "What data or metric would show that your explanation is correct?";
}

// Check whether the text contains at least one word from the provided list
function includesAny(text, words) {
  return words.some((word) => text.includes(word.toLowerCase()));
}

// Count how many words from the provided list appear in the text
function countMatches(text, words) {
  return words.filter((word) => text.includes(word.toLowerCase())).length;
}

// Export the OpenAI service functions for use in controllers and other services
module.exports = {
  generateSocraticResponse,
  generateControlResponse,
  generateSocraticHint,
  evaluateLayerWithOpenAI,
};
