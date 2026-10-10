"use client";

import React from "react";
import {
  Box,
  Container,
  Flex,
  HStack,
  VStack,
  Text,
  Link,
  Icon,
} from "@chakra-ui/react";
import { Leaf, Heart, Mail, Github, Twitter } from "lucide-react";

interface FooterLinkProps {
  href: string;
  children: React.ReactNode;
}

const FooterLink: React.FC<FooterLinkProps> = ({ href, children }) => (
  <Link
    href={href}
    color="gray.600"
    fontSize="sm"
    _hover={{ color: "green.600", textDecoration: "none" }}
    transition="color 0.2s"
  >
    {children}
  </Link>
);

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <Box
      as="footer"
      bg="white"
      borderTop="1px solid"
      borderColor="gray.200"
      py={8}
      mt="auto"
    >
      <Container maxW="container.xl">
        <Flex
          direction={{ base: "column", md: "row" }}
          justify="space-between"
          align={{ base: "center", md: "flex-start" }}
          gap={8}
        >
          {/* Brand Section */}
          <VStack align={{ base: "center", md: "flex-start" }} gap={3}>
            <HStack gap={2}>
              <Box color="green.500">
                <Leaf size={24} />
              </Box>
              <Text fontWeight="bold" fontSize="lg" color="gray.800">
                GrowBuddy
              </Text>
            </HStack>
            <Text fontSize="sm" color="gray.500" maxW="250px" textAlign={{ base: "center", md: "left" }}>
              Your personal plant care companion. Track, nurture, and grow your garden with ease.
            </Text>
          </VStack>

          {/* Links Sections */}
          <Flex
            direction={{ base: "column", sm: "row" }}
            gap={{ base: 6, sm: 12 }}
            align={{ base: "center", sm: "flex-start" }}
          >
            {/* Company */}
            <VStack align={{ base: "center", sm: "flex-start" }} gap={2}>
              <Text fontWeight="semibold" fontSize="sm" color="gray.800" mb={1}>
                Company
              </Text>
              <FooterLink href="/about">About Us</FooterLink>
              <FooterLink href="/mission">Our Mission</FooterLink>
              <FooterLink href="/blog">Blog</FooterLink>
              <FooterLink href="/careers">Careers</FooterLink>
            </VStack>

            {/* Resources */}
            <VStack align={{ base: "center", sm: "flex-start" }} gap={2}>
              <Text fontWeight="semibold" fontSize="sm" color="gray.800" mb={1}>
                Resources
              </Text>
              <FooterLink href="/help">Help Center</FooterLink>
              <FooterLink href="/guides">Plant Guides</FooterLink>
              <FooterLink href="/community">Community</FooterLink>
              <FooterLink href="/api">API Docs</FooterLink>
            </VStack>

            {/* Legal */}
            <VStack align={{ base: "center", sm: "flex-start" }} gap={2}>
              <Text fontWeight="semibold" fontSize="sm" color="gray.800" mb={1}>
                Legal
              </Text>
              <FooterLink href="/privacy">Privacy Policy</FooterLink>
              <FooterLink href="/terms">Terms of Service</FooterLink>
              <FooterLink href="/cookies">Cookie Policy</FooterLink>
            </VStack>
          </Flex>
        </Flex>

        {/* Bottom Section */}
        <Box
          borderTop="1px solid"
          borderColor="gray.200"
          mt={8}
          pt={6}
        >
          <Flex
            direction={{ base: "column", sm: "row" }}
            justify="space-between"
            align="center"
            gap={4}
          >
            <Text fontSize="sm" color="gray.500">
              &copy; {currentYear} GrowBuddy. Made with{" "}
              <Box as="span" display="inline-block" verticalAlign="middle">
                <Heart size={14} color="#E53E3E" fill="#E53E3E" />
              </Box>
              {" "}for plant lovers.
            </Text>

            {/* Social Links */}
            <HStack gap={4}>
              <Link
                href="mailto:hello@example.com"
                color="gray.500"
                _hover={{ color: "green.600" }}
                aria-label="Email us"
              >
                <Mail size={20} />
              </Link>
              <Link
                href="https://github.com/example"
                color="gray.500"
                _hover={{ color: "green.600" }}
                aria-label="GitHub"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github size={20} />
              </Link>
              <Link
                href="https://twitter.com/example"
                color="gray.500"
                _hover={{ color: "green.600" }}
                aria-label="Twitter"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Twitter size={20} />
              </Link>
            </HStack>
          </Flex>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
