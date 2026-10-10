import { forwardRef } from "react"
import { Link as RouterLink, type LinkProps as RouterLinkProps } from "react-router-dom"
import { chakra, type SystemStyleObject } from "@chakra-ui/react"

const ChakraLink = chakra(RouterLink)

interface LinkProps extends Omit<RouterLinkProps, 'style'> {
  style?: React.CSSProperties
  css?: SystemStyleObject
  [key: string]: any
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(({ to, ...props }, ref) => {
  return <ChakraLink ref={ref} to={to} {...props} />
})

Link.displayName = "Link"
