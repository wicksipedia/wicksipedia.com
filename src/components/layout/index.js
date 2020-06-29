import React from "react";
import PropTypes from "prop-types";
import Helmet from "react-helmet";
import { StaticQuery, graphql } from "gatsby";
import Navbar from "./navbar/navbar";
import Footer from "./footer/footer";

// code syntax-highlighting theme
// feel free to change it to another one
import "prismjs/themes/prism-twilight.css";

// main site style
import "./index.scss";

const TemplateWrapper = ({ children, data }) => {
	return (
		<StaticQuery
			query={pageQuery}
			render={(data) => (
				<>
					<Helmet title={data.site.siteMetadata.title} />
					<div className="content-wrapper">
						<Navbar title={data.site.siteMetadata.title} />
						<main>{children}</main>
						<Footer />
					</div>
				</>
			)}
		/>
	);
};

TemplateWrapper.propTypes = {
	children: PropTypes.object,
};

const pageQuery = graphql`
	query LayoutIndexQuery {
		site {
			siteMetadata {
				title
			}
		}
	}
`;

export default TemplateWrapper;
