import React, {FunctionComponent, useState} from "react";
import { useStaticQuery, graphql, Link } from "gatsby";
import Img from "gatsby-image";
import {MenuItem} from "../../utils/models";

interface NavigationProps {
  title: string;
  menu: MenuItem[];
  showSearch: boolean;
  dark?: boolean;
}

const Navigation: FunctionComponent<NavigationProps> = ({title, menu, dark = false, showSearch = true}) => {

  const [showAllLinks, setShowAllLinks] = useState(false);

  const logo = useStaticQuery(graphql`
    query {
      file(sourceInstanceName: {eq: "assets"}, name: {eq: "logo"}) {
        childImageSharp {
          fixed(width: 30, height: 30) {
            ...GatsbyImageSharpFixed
          }
        }
      }
    }
  `);
  
  return (
    <nav className="flex items-center justify-between flex-wrap sticky top-0 w-full z-20 bg-teal-500 p-6">
      <div className="flex items-center flex-shrink-0 text-white mr-6">
        <Img className="h-10 w-10 m-2" fixed={logo.file.childImageSharp.fixed} alt={title}/>
        <span className="font-semibold text-xl tracking-tight">{title}</span>
      </div>
      <div className="block lg:hidden">
        <button
          className="flex items-center px-3 py-2 border rounded text-teal-200 border-teal-400 hover:text-white hover:border-white"
          onClick={() => setShowAllLinks(!showAllLinks)}>
          <svg className="fill-current h-3 w-3" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><title>Menu</title><path d="M0 3h20v2H0V3zm0 6h20v2H0V9zm0 6h20v2H0v-2z"/></svg>
        </button>
      </div>
      <div className={`w-full block flex-grow lg:flex lg:items-center lg:w-auto ${showAllLinks ? 'visible' : 'hidden'}`}>
        <div className="text-sm lg:flex-grow">
          {menu.map((item, index) => (
            <Link key={index}
              className="block mt-4 lg:inline-block lg:mt-0 text-teal-200 hover:text-white mr-4"
              to={item.path}>
              {item.name}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
