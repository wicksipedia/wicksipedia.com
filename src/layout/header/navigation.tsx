import React, {FunctionComponent, useState} from "react";
import { Link } from "gatsby";
import { MenuItem } from "../../utils/models";
import { Container } from "../../components/common";
import styled from "@emotion/styled";
import tw from "twin.macro";

interface NavigationProps {
  title: string;
  menu: MenuItem[];
  showSearch: boolean;
  dark?: boolean;
}

const NavWrapper = styled.nav([
  tw`w-full bg-teal-500 p-2`
]);

const NavContainer = styled.div([
  tw`container mx-auto flex items-center justify-between flex-wrap`
]);

const Navigation: FunctionComponent<NavigationProps> = ({title, menu, dark = false, showSearch = true}) => {

  const [showAllLinks, setShowAllLinks] = useState(false);
  
  return (
    <NavWrapper>
      <NavContainer>
        <div className="text-white mr-6">
          <a href={'/'} className="font-semibold text-xl tracking-tight">{title}</a>
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
      </NavContainer>
    </NavWrapper>
  );
};

export default Navigation;
