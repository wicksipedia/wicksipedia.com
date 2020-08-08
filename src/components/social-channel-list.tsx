import React, {FunctionComponent} from "react";
import {SocialChannels} from "../../utils/models";
import styled from '@emotion/styled';
import {
  FaFacebook,
  FaGithub,
  FaInstagram,
  FaLinkedin,
  FaQuestionCircle,
  FaTwitch,
  FaTwitter,
  FaYoutube,
} from "react-icons/fa";
import { OutboundLink } from "gatsby-plugin-google-analytics";
import tw from "twin.macro";

interface SocialChannelListProps {
  channels: SocialChannels;
}

// Returns a proper icon for a given channel
const createSocialIcon = (channel: keyof SocialChannels) => {
  switch (channel) {
    case "twitter":
      return <FaTwitter/>;
    case "facebook":
      return <FaFacebook/>;
    case "github":
      return <FaGithub/>;
    case "instagram":
      return <FaInstagram/>;
    case "linkedin":
      return <FaLinkedin/>;
    case "twitch":
      return <FaTwitch/>;
    case "youtube":
      return <FaYoutube/>;
  }

  return <FaQuestionCircle/>;
};

const StyledSocialChannels = styled.ul([
  tw`list-none m-0`
]);

const StyledSocialChannel = styled.li([
  tw`inline-block my-0 mx-4 text-xl opacity-75`
]);

const SocialChannelList: FunctionComponent<SocialChannelListProps> = ({channels}) => (
  <StyledSocialChannels>
    {(Object.keys(channels)).filter(c => channels[c] !== '').map((channel, index) => (
      <StyledSocialChannel key={index}>
        <OutboundLink
          href={channels[channel]}
          target={`_blank`}
          rel={`noopener`}
          aria-label={channel}
        >
          {createSocialIcon(channel as keyof SocialChannels)}
        </OutboundLink>
      </StyledSocialChannel>
    ))}
  </StyledSocialChannels>
);

export default SocialChannelList;
