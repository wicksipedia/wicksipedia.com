export const SITE = {
  website: "https://wicksipedia.com/", // replace this with your deployed domain
  author: "Matt Wicks",
  profile: "https://wicksipedia.com/",
  desc: "A personal blog about technology, programming, and software development.",
  title: "Wicksipedia",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 4,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true, // show back button in post detail
  editPost: {
    enabled: true,
    text: "Edit page",
    url: "https://github.com/wicksipedia/wicksipedia.com/edit/main/",
  },
  repo: "https://github.com/wicksipedia/wicksipedia.com",
  dynamicOgImage: true,
  dir: "ltr", // "rtl" | "auto"
  lang: "en", // html lang code. Set this empty and default will be "en"
  timezone: "Australia/Sydney", // Default global timezone (IANA format) https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
} as const;
