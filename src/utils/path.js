exports.pathToPost = (frontmatter) => {
    const createdDate = new Date(frontmatter.created);
    const path = frontmatter.path.startsWith('/') ? frontmatter.path.slice(1) : frontmatter.path;
    return `/${createdDate.getFullYear()}/${createdDate.getMonth() + 1}/${path}`;
};