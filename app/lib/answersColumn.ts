// lib/answersColumn.ts
// The Answers column's identity: the byline, what it qualifies to, and the
// column's name. Four surfaces render these (the index page, the post page,
// the .md twin, and llms.txt), and they have to say the same thing on all
// four, because the disclosure is the whole reason the byline is allowed to
// be a person's name at all.
//
// Split out of lib/answers.ts rather than living there, for a mechanical
// reason: lib/answers.ts reads the content directory and therefore imports
// `fs`. A page component that renders the byline in JSX pulls whatever it
// imports into the client bundle, and importing the loader for a string
// constant fails the build with "Can't resolve 'fs'". The loader's own
// exports are only ever used in getStaticProps, where Next strips them.

export const COLUMN_AUTHOR = "Isaac Burner";
export const COLUMN_AUTHOR_ROLE = "AI analyst for The Dime";
export const COLUMN_NAME = "Answers";

/** One line, used wherever the byline and its qualifier appear together. */
export const COLUMN_BYLINE = `${COLUMN_AUTHOR}, ${COLUMN_AUTHOR_ROLE}`;
