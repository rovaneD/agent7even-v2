export interface Question {
  id: string
  question: string
  subtext?: string
  type: 'text' | 'textarea' | 'multiselect' | 'select'
  options?: string[]
  placeholder?: string
}

export interface Chapter {
  id: string
  title: string
  description: string
  emoji: string
  questions: Question[]
}

export const BRAND_CHAPTERS: Chapter[] = [
  {
    id: 'foundation',
    title: 'Foundation',
    description: 'What your business is and does',
    emoji: '🏗️',
    questions: [
      {
        id: 'business_description',
        question: 'Describe your business in 2-3 sentences.',
        subtext: 'What do you do, and how do you do it differently?',
        type: 'textarea',
        placeholder: 'We help small restaurant owners...',
      },
      {
        id: 'who_you_serve',
        question: 'Who is your ideal client?',
        subtext: 'Be specific — industry, size, stage, mindset.',
        type: 'textarea',
        placeholder: 'Small business owners with 1-10 employees who...',
      },
      {
        id: 'problem_solved',
        question: 'What specific problem do you solve for them?',
        subtext: 'What were they struggling with before they found you?',
        type: 'textarea',
        placeholder: 'Before working with us, our clients struggled with...',
      },
      {
        id: 'transformation',
        question: 'What transformation do you deliver?',
        subtext: 'What does life look like for your client after working with you?',
        type: 'textarea',
        placeholder: 'After working with us, our clients feel...',
      },
    ],
  },
  {
    id: 'purpose',
    title: 'Purpose & Values',
    description: 'Why you exist beyond profit',
    emoji: '🧭',
    questions: [
      {
        id: 'mission',
        question: 'What is your mission — why does your business exist?',
        subtext: 'Beyond making money, what drives you?',
        type: 'textarea',
        placeholder: 'We exist to...',
      },
      {
        id: 'core_values',
        question: 'Choose your core values.',
        subtext: 'Select up to 5 that genuinely reflect how you operate.',
        type: 'multiselect',
        options: [
          'Authenticity', 'Integrity', 'Innovation', 'Excellence', 'Community',
          'Simplicity', 'Boldness', 'Empathy', 'Transparency', 'Creativity',
          'Reliability', 'Growth', 'Impact', 'Collaboration', 'Fun',
          'Quality', 'Inclusion', 'Sustainability', 'Trust', 'Leadership',
        ],
      },
      {
        id: 'stands_for',
        question: 'What does your brand stand for?',
        subtext: 'What do you champion, advocate for, or believe strongly in?',
        type: 'textarea',
        placeholder: 'We believe that every small business deserves...',
      },
      {
        id: 'stands_against',
        question: 'What does your brand stand against?',
        subtext: 'What frustrates you about your industry? What do you refuse to do?',
        type: 'textarea',
        placeholder: 'We will never...',
      },
    ],
  },
  {
    id: 'personality',
    title: 'Personality',
    description: 'How your brand feels and speaks',
    emoji: '🎭',
    questions: [
      {
        id: 'personality_words',
        question: 'Choose 3-5 words that describe your brand personality.',
        subtext: 'If your brand were a person, how would you describe them?',
        type: 'multiselect',
        options: [
          'Bold', 'Warm', 'Professional', 'Playful', 'Sophisticated',
          'Approachable', 'Authoritative', 'Quirky', 'Calm', 'Energetic',
          'Witty', 'Nurturing', 'Direct', 'Inspiring', 'Grounded',
          'Luxurious', 'Casual', 'Edgy', 'Classic', 'Modern',
        ],
      },
      {
        id: 'tone_descriptors',
        question: 'How does your brand communicate?',
        subtext: 'Pick the tone that best describes your voice.',
        type: 'multiselect',
        options: [
          'Conversational', 'Formal', 'Humorous', 'Serious', 'Motivational',
          'Educational', 'Storytelling', 'Data-driven', 'Empathetic', 'Confident',
          'Friendly', 'Expert', 'Supportive', 'Challenging', 'Inspirational',
        ],
      },
      {
        id: 'tone_avoid',
        question: 'What tone should your brand NEVER use?',
        subtext: 'What communication style feels completely off-brand for you?',
        type: 'textarea',
        placeholder: 'We never want to sound aggressive, salesy, or...',
      },
      {
        id: 'brand_admired',
        question: 'Name 2-3 brands you admire and why.',
        subtext: "They don't need to be in your industry — just brands whose voice you respect.",
        type: 'textarea',
        placeholder: 'I love how Apple communicates because...',
      },
    ],
  },
  {
    id: 'audience',
    title: 'Your Audience',
    description: 'The people you serve deeply',
    emoji: '🎯',
    questions: [
      {
        id: 'client_fears',
        question: "What does your ideal client fear most?",
        subtext: 'What keeps them up at night? What are they most afraid of failing at?',
        type: 'textarea',
        placeholder: 'My ideal client is afraid of...',
      },
      {
        id: 'client_aspirations',
        question: 'What does your ideal client want most?',
        subtext: "What's their dream outcome? What are they working toward?",
        type: 'textarea',
        placeholder: 'More than anything, my ideal client wants...',
      },
      {
        id: 'client_objections',
        question: 'What objections do they have before working with you?',
        subtext: "What hesitations or doubts come up before they say yes?",
        type: 'textarea',
        placeholder: "Before working with us, clients often worry about...",
      },
      {
        id: 'what_they_need_to_hear',
        question: 'What does your ideal client need to hear from you?',
        subtext: 'What message would make them feel truly understood?',
        type: 'textarea',
        placeholder: 'They need to know that...',
      },
    ],
  },
  {
    id: 'positioning',
    title: 'Positioning',
    description: 'Where you sit in the market',
    emoji: '📍',
    questions: [
      {
        id: 'competitors',
        question: 'Who are your main competitors or alternatives?',
        subtext: "Who else is your ideal client considering? Include DIY alternatives.",
        type: 'textarea',
        placeholder: 'Our clients also consider...',
      },
      {
        id: 'differentiators',
        question: 'What makes you genuinely different?',
        subtext: "Not just better — but different. What can you claim that no one else can?",
        type: 'textarea',
        placeholder: 'Unlike other options, we...',
      },
      {
        id: 'proof_points',
        question: 'What proof do you have that you deliver results?',
        subtext: 'Results, testimonials, case studies, credentials, years of experience.',
        type: 'textarea',
        placeholder: 'We have helped X clients achieve...',
      },
      {
        id: 'price_positioning',
        question: 'How are you positioned on price?',
        type: 'select',
        options: [
          'Budget-friendly — accessible to everyone',
          'Mid-market — fair value for quality',
          'Premium — higher price, higher value',
          'Luxury — exclusive, top of market',
        ],
      },
    ],
  },
  {
    id: 'story',
    title: 'Your Story',
    description: 'The human side of your brand',
    emoji: '📖',
    questions: [
      {
        id: 'origin_story',
        question: 'How did your business come to be?',
        subtext: 'What happened that made you start this? What problem did you personally experience?',
        type: 'textarea',
        placeholder: 'I started this business because...',
      },
      {
        id: 'founder_motivation',
        question: 'What keeps you going on the hard days?',
        subtext: 'What is the deeper reason you do this work?',
        type: 'textarea',
        placeholder: 'Even on the hardest days, I keep going because...',
      },
      {
        id: 'defining_moment',
        question: 'What is a defining moment in your business journey?',
        subtext: 'A turning point, a breakthrough, a failure that taught you something critical.',
        type: 'textarea',
        placeholder: 'The moment that changed everything was...',
      },
      {
        id: 'future_vision',
        question: 'Where is your business going?',
        subtext: 'What does success look like in 3-5 years? What impact do you want to have?',
        type: 'textarea',
        placeholder: 'In 5 years, we will have...',
      },
    ],
  },
]

export const DOCUMENT_TYPES = [
  {
    type: 'voice',
    title: 'Brand Voice Statement',
    description: 'Your tone of voice guide — how to write, words to use, words to avoid',
    abbr: 'BV',
  },
  {
    type: 'story',
    title: 'Brand Story',
    description: 'Your origin, mission, and who you serve — in narrative form',
    abbr: 'BS',
  },
  {
    type: 'persona',
    title: 'Ideal Client Profile',
    description: 'A detailed persona of your perfect client',
    abbr: 'IC',
  },
  {
    type: 'positioning',
    title: 'Brand Positioning Statement',
    description: 'Your unique position in the market — clear and compelling',
    abbr: 'BP',
  },
]
