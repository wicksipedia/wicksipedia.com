export interface SiteMetadata {
  title: string;
  siteUrl: string;
  description: string;
  topics: string[];
  menu: MenuItem[];
  footerMenu: MenuItem[];
  search: boolean;
  author: {
    name: string;
    description: string;
    social: SocialChannels;
  };
}

export interface Tag {
  name: string;
  icon: any;
}

export interface SocialChannels {
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  instagram?: string;
  youtube?: string;
  github?: string;
  twitch?: string;
}

export interface MenuItem {
  name: string;
  path: string;
}

export interface Post {
  id: string;
  frontmatter: {
    title: string;
    path: string;
    tags: string[];
    excerpt: string;
    created: string;
    createdPretty: string;
    updated: string;
    updatedPretty: string;
    featuredImage?: any;
  };
  html: string;
  timeToRead: number;
  headings: Array<{ depth: number }>;
  file: {
    contentPath: string;
  }
}

export interface Page {
  frontmatter: {
    title: string;
    path: string;
    excerpt: string;
  };
  html: string;
}
