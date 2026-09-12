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
      {
        quote: "I feel like I've got someone taking care of me while at the same time encouraging me to work to my maximum potential!",
        name: "Juan Monteroz",
        detail: "Neck, Shoulders & Hips",
      },
      {
        quote: "Toby is so good at what he does. Based on extensive knowledge of the anatomy, we managed to avoid surgery entirely. I highly recommend him to you",
        name: "Elaine Gibson Bolton",
        detail: "Leg",
      },
      {
        quote: "I am so pleased Toby was recommended to me - he has truly worked miracles. He seems to be able to get to the heart of the problem and listens and adapts his programmes sensitively",
        name: "Ida Forster",
        detail: "Leg",
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

export type MenuIcon =
  | "calendar"
  | "list"
  | "pin"
  | "inbox"
  | "clock"
  | "users"
  | "settings"
  | "user"
  | "bell"
  | "help"
  | "shield";

export type MenuItem = {
  label: string;
  /** "calendar" opens the in-app calendar modal instead of navigating. */
  href: string | "calendar";
  icon: MenuIcon;
  badge?: "upcoming" | "pending";
};
export type MenuGroup = { group: string; items: MenuItem[] };

/** Account menu (top-right avatar), by role. Sign out is appended by the component. */
export const USER_MENU: Record<"CLIENT" | "TRAINER", MenuGroup[]> = {
  CLIENT: [
    {
      group: "Booking",
      items: [
        { label: "Book a session", href: "calendar", icon: "calendar" },
        { label: "My sessions", href: "/app", icon: "list", badge: "upcoming" },
        { label: "My locations", href: "/app/locations", icon: "pin" },
      ],
    },
    {
      group: "Account",
      items: [
        { label: "My profile", href: "/account", icon: "user" },
        { label: "Notifications", href: "/account#notifications", icon: "bell" },
      ],
    },
    {
      group: "Support",
      items: [
        { label: "Help & contact", href: "/#contact", icon: "help" },
        { label: "Privacy policy", href: "/privacy-policy", icon: "shield" },
      ],
    },
  ],
  TRAINER: [
    {
      group: "Diary",
      items: [
        { label: "Calendar", href: "calendar", icon: "calendar" },
        { label: "Requests", href: "/trainer/requests", icon: "inbox", badge: "pending" },
        { label: "Availability", href: "/trainer/availability", icon: "clock" },
        { label: "Clients", href: "/trainer/clients", icon: "users" },
        { label: "Settings", href: "/trainer/settings", icon: "settings" },
      ],
    },
    {
      group: "Account",
      items: [
        { label: "My profile", href: "/account", icon: "user" },
        { label: "Notifications", href: "/account#notifications", icon: "bell" },
      ],
    },
    {
      group: "Support",
      items: [
        { label: "Help & contact", href: "/#contact", icon: "help" },
        { label: "Privacy policy", href: "/privacy-policy", icon: "shield" },
      ],
    },
  ],
};
