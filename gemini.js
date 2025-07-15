import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const subtopics = [
  // General Awareness
  "Current Affairs", "Indian History", "Indian Polity & Constitution", "Indian Geography", "Indian Economy",
  "Sports & Games", "Important Days & Events", "Awards & Honors", "Science & Technology", "Books and Authors",
  "Government Schemes", "Budget & Five-Year Plans",
  // Reasoning
  "Analogies", "Number & Alphabet Series", "Coding-Decoding", "Blood Relations", "Direction Sense Test",
  "Ranking & Order", "Venn Diagrams", "Puzzles", "Syllogism", "Calendar & Clock", "Classification", "Non-Verbal Reasoning",
  // Maths
  "Number System", "Simplification", "HCF & LCM", "Ratio & Proportion", "Percentage", "Profit & Loss",
  "Simple & Compound Interest", "Time & Work", "Time, Speed & Distance", "Averages", "Mixture & Allegation", "Data Interpretation",
  // English
  "Grammar", "Reading Comprehension", "Fill in the Blanks", "Synonyms & Antonyms", "Idioms & Phrases",
  "One-word Substitution", "Error Detection", "Spelling Correction", "Sentence Rearrangement",
  // Hindi
  "व्याकरण", "मुहावरे और लोकोक्तियाँ", "पर्यायवाची और विलोम", "अपठित गद्यांश", "वाक्य सुधार",
  "शब्द शुद्धि", "वाक्य विन्यास",
  // Computer
  "Basics of Computers", "Input & Output Devices", "MS Word, Excel, PowerPoint", "Internet and Email",
  "Operating Systems", "Computer Abbreviations", "Shortcut Keys", "Basic Networking",
  // Science
  "Physics", "Chemistry", "Biology", "Environmental Science", "Scientific Inventions",
  // Haryana GK
  "History of Haryana", "Geography of Haryana", "Culture & Heritage", "Art & Literature", "Festivals & Fairs",
  "Important Rivers & Lakes", "Economy of Haryana", "Famous Personalities", "Sports in Haryana",
  "Haryana Current Affairs", "Recent Govt. Schemes", "Environment & Ecology of Haryana"
];

function getRandomSubtopic() {
  const randomIndex = Math.floor(Math.random() * subtopics.length);
  return subtopics[randomIndex];
}

export async function getQuizQuestion() {
  const subtopic = getRandomSubtopic();

  const prompt = `"${subtopic}" विषय पर हरियाणा CET / HSSC / HPSC स्तर का एक बेहद कठिन, दुर्लभ और यूनिक बहुविकल्पीय प्रश्न हिंदी में बनाएं।

❗ प्रश्न ऐसा हो जो अब तक किसी भी परीक्षा में नहीं पूछा गया हो, बहुत ही उच्च स्तर का और कम ज्ञात तथ्यों पर आधारित हो — जैसे कि सबसे पुराने ऐतिहासिक तथ्यों या हाल ही की घटनाओं से संबंधित।

❗ केवल इस फॉर्मेट में उत्तर दें (बिना किसी व्याख्या के):

प्रश्न: ...
A. ...
B. ...
C. ...
D. ...
उत्तर: A (या B, C, D — केवल एक अक्षर)

👇 फिर उसी प्रश्न से संबंधित 6–7 बिंदुओं में एक संक्षिप्त विवरण (Short Notes / Bio / Explanation) दें, जैसे:
- पहला मुख्यमंत्री कौन थे
- कब पद संभाला
- प्रमुख उपलब्धियाँ
- कितनी बार मुख्यमंत्री रहे`;

  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) throw new Error("Invalid Gemini response");
    return parseGeminiResponse(text);
  } catch (err) {
    console.error("❌ Gemini Fetch Error:", err.message);
    throw err;
  }
}

function parseGeminiResponse(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const questionLine = lines.find(line => /^प्रश्न[:：]?\s*/.test(line));
  const question = questionLine?.replace(/^प्रश्न[:：]?\s*/, "");

  const options = lines
    .filter(line => /^[A-D][\.-:：]?\s*/.test(line))
    .map(line => line.replace(/^[A-D][\.-:：]?\s*/, "").trim());

  const answerLine = lines.find(line => /^उत्तर[:：]?\s*/.test(line));
  const raw = answerLine?.replace(/^उत्तर[:：]?\s*/, "").trim();
  const correctIndex = { A: 0, B: 1, C: 2, D: 3 }[raw?.toUpperCase()] ?? -1;

  const bioStart = lines.findIndex(line => line.startsWith("-"));
  const explanation = lines.slice(bioStart).join("\n");

  if (!question || options.length !== 4 || correctIndex === -1 || !explanation) {
    throw new Error("Gemini response missing required parts");
  }

  return {
    question,
    options,
    correct: correctIndex.toString(),
    explanation,
  };
}
