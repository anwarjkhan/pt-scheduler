/** Copy and links lifted from tjmtraining.com. Edit here to change the marketing site. */
export const SITE = {
  name: "TJM Training",
  strapline: "Keeping you fit & healthy",
  email: "toby@tjmtraining.com",
  phone: "07738 262 889",
  phoneHref: "tel:+447738262889",
  address: "Thames Ditton, Surrey",
  social: {
    instagram: "https://www.instagram.com/tjmtraining/",
    facebook: "https://www.facebook.com/TjmTraining/",
  },
  hours: [
    ["Mon–Fri", "6am to 7pm"],
    ["Saturday", "9am to 12pm"],
    ["Sunday", "Closed"],
  ],
  nav: [
    { label: "Meet Toby", href: "/#meet-toby" },
    { label: "Training Options", href: "/#training-options" },
    { label: "Kind words", href: "/#kind-words" },
    { label: "Contact", href: "/#contact" },
  ],
  intro: {
    heading: "Suffering from stiffness and discomfort?",
    body: "If you’re here you’re probably aware that carefully guided exercise sessions will help to get rid of this.",
    offer: "For a free unique 30 minute video to take you on your journey to a better and pain free lifestyle.",
    cta: "Email Toby",
    ctaHref: "mailto:toby@tjmtraining.com?subject=I%E2%80%99d%20like%20to%20get%20a%20free%20Unique%2030%20minute%20video",
  },
  hero: {
    heading: "Unlock your potential now!",
    body: "Expert guidance that will leave you feeling better and more energised, increasing your flexibility, your strength and your overall fitness",
    pillars: ["Health", "Movement", "Prehab", "Rehab", "Fitness", "Biomechanics", "Injury Prevention"],
  },
  meet: {
    heading: "Meet Toby",
    body: "I work with my clients to give them the results they want to function better, move better and feel better. I develop beginning to end programmes focussed on empowering them to achieve their vision, improve their health and their way of life!",
    qualifications: [
      "Corrective Exercise Specialist (CES) with NASM",
      "Level Three Personal Trainer with REPS",
      "Advance Kettle Bell Instructor for Sports Injury & Rehabilitation",
      "PD Warrior Certified Trainer for Patients with Parkinson’s Disease",
    ],
  },
  kindWords: {
    heading: "Everyone should have a Toby in their life",
    testimonials: [
      {
        quote: "The prehab work that I did with Toby was excellent. He is rebuilding my confidence and getting me fit again",
        name: "Stephen Menzies",
        detail: "Knee & Lower Back",
      },
    ],
  },
  options: [
    {
      title: "One-to-One",
      image: "/site/option-one-to-one.jpg",
      body: "Get the very best deal with training sessions specifically customised to meet your requirements. Train with confidence that everything you do has been planned ahead specifically for you!",
    },
    {
      title: "One-to-Four",
      image: "/site/option-one-to-four.jpg",
      body: "Enjoy the spirit and community feeling of working in a group with like minded people all training for the same goal, to make their bodies work better for them!",
    },
    {
      title: "On-line",
      image: "/site/option-online.jpg",
      body: "My on-line training classes are specifically targeted to working without heavy equipment so you can do this in the comfort of your own home! We use entirely body weight and resistance bands, carefully working through the whole body. At the end of a 30 minute exercise session you will really know you’ve worked. The results are amazing!",
    },
  ],
  partners: [
    {
      name: "Fitpro",
      image: "/site/partner-fitpro.png",
      body: "Fitpro have lead the way as the authoritive body in the fitness industry for many years. Members enjoy access to the latest courses in the industry and the most innovative leaders.",
    },
    {
      name: "PD Warrior",
      image: "/site/partner-pdwarrior.png",
      body: "Research into Parkinson Disease may still be in it’s infancy but it is now undisputed that exercise plays a huge part in stalling its impact. The PD Warrior programme is at its forefront.",
    },
    {
      name: "NASM",
      image: "/site/partner-nasm.png",
      body: "NASM had long since pioneered sports medicine and an understanding of human biomechanics. They are recognised as the leading American educator in the fitness industry.",
    },
  ],
  areasBlurb: "TJM Training offers bespoke one-to-one sessions tailored to you in the following areas regularly:",
  areasList: "Weybridge, Hersham, Esher, Cobham, Thames Ditton, Kingston, Surbiton, Richmond",
  areas: [
    { label: "Weybridge", slug: "personal-trainer-weybridge" },
    { label: "Esher", slug: "personal-trainer-esher" },
    { label: "Hampton Court", slug: "personal-trainer-hampton-court" },
    { label: "Cobham", slug: "personal-trainer-cobham" },
    { label: "Hersham", slug: "personal-trainer-hersham" },
    { label: "Oxshott", slug: "personal-trainer-oxshott" },
  ],
  rehab: [
    { label: "Injury Rehab Cobham", slug: "injury-rehab-pt-cobham" },
    { label: "Injury Rehab Weybridge", slug: "injury-rehab-coach-weybridge" },
    { label: "Injury Rehab Esher", slug: "injury-rehab-esher" },
  ],
};

/** Links shown in the signed-in user menu, by role. */
export const USER_MENU = {
  CLIENT: [
    { label: "Book a session", href: "/#book" },
    { label: "My sessions", href: "/app" },
    { label: "My locations", href: "/app/locations" },
  ],
  TRAINER: [
    { label: "Calendar", href: "/trainer" },
    { label: "Requests", href: "/trainer/requests" },
    { label: "Availability", href: "/trainer/availability" },
    { label: "Clients", href: "/trainer/clients" },
    { label: "Settings", href: "/trainer/settings" },
  ],
} as const;
