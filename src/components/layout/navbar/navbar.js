import React from "react";
import { Container } from "reactstrap";
import PropTypes from "prop-types";
import Link from "gatsby-link";

const Navbar = ({ title }) => {
	return (
		<div className="navbar navbar-expand-lg navbar-dark bg-primary">
			<Container>
				<Link to="/" className="navbar-brand">
					{title}
				</Link>
				<ul className="nav navbar-nav">
					<li className="nav-item">
						<Link to="/about" className="nav-link">
							About
						</Link>
					</li>
				</ul>
			</Container>
		</div>
	);
};

Navbar.propTypes = {
	title: PropTypes.string,
};

export default Navbar;
