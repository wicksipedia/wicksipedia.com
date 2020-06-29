import React from "react";
import { StaticQuery, graphql } from "gatsby";
import { Container } from "reactstrap";

const Footer = () => {
	return (
		<StaticQuery
			query={footerQuery}
			render={(data) => (
				<nav className="navbar navbar-dark bg-dark py-1">
					<span class="navbar-text">
						© Wicksipedia - Made with ♥️ using Gatsby, Netlify and GitHub
					</span>
					<span class="navbar-text ml-auto">{data.gitCommit.hash.substring(0,7)}</span>
				</nav>
			)}
		/>
	);
};

const footerQuery = graphql`
	query FooterQuery {
		gitCommit(latest: { eq: true }) {
			hash
		}
	}
`;

export default Footer;
