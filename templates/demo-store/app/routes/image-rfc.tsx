import {type LoaderArgs} from '@hydrogen/remix';
import {useLoaderData} from '@remix-run/react';
import {json} from '@remix-run/oxygen';

/* @TODO: 
  - [ ] Support original aspect ratio
  - [ ] Picture element
  - [ ] Support for non-100% widths
  - [ ] Support for third party data loaders
  - [ ] Create guide/docs
  - [ ] Scale seems auto-detected; confirm true, and if so, remove prop
  - [ ] Consider `loaded` render prop, for blurred placeholder
  - [ ] Write tests
  - [ ] Bikeshed on prop names
  - [ ] Improve types / intellisense support
*/

interface ImageConfig {
  intervals: number;
  startingWidth: number;
  incrementSize: number;
  placeholderWidth: number;
}
type Crop = 'center' | 'top' | 'bottom' | 'left' | 'right' | undefined;

type ImageRFCData = {
  product: {
    featuredImage: {
      altText: string;
      url: string;
    };
  };
};

export const IMAGE_FRAGMENT = `#graphql
  fragment Image on Image {
    altText
    url
  }
`;

export async function loader({context: {storefront}}: LoaderArgs) {
  const data: ImageRFCData = await storefront.query({
    query: `#graphql
    query {
      product(handle: "snowboard") {
       featuredImage {
         ...Image
       }
      }
    }
    ${IMAGE_FRAGMENT}
  `,
    variables: {},
  });

  return json(data.product.featuredImage);
}

export default function ImageRFC() {
  const {altText, url} = useLoaderData<typeof loader>();

  return <Image src={url} alt={altText} aspectRatio="1/1" sizes="100vw" />;

  /* Picture component should look something like:
      <Picture
        width="100%"
        {...props}>
        <Image 
          src={data.src} 
          aspectRatio="4/5" 
          sizes="100vw" 
          media="(min-width: 800px)" />
        <Image 
          src={data.src} 
          aspectRatio="2/3" 
          sizes="100vw" 
          media="(min-width: 1200px)" />
    </Picture>

    When inside <Picture /> the <Image /> component should render a <source> element,
    the last <Image /> component should render an <img> element.
  */
}

export function Image({
  as: Component = 'img',
  src = 'https://cdn.shopify.com/static/sample-images/garnished.jpeg',
  width = '100%',
  sizes = '(min-width: 768px) 50vw, 100vw',
  aspectRatio = '1/1',
  scale,
  config = {
    intervals: 20,
    startingWidth: 200,
    incrementSize: 100,
    placeholderWidth: 100,
  },
  alt = 'Test Alt Tag',
  ...passthroughProps
}: {
  as?: 'img' | 'source';
  src: string;
  width?: string | number;
  sizes: string;
  aspectRatio: string;
  scale?: number;
  config?: ImageConfig;
  alt: string;
}) {
  const {intervals, startingWidth, incrementSize, placeholderWidth} = config;

  const widths = generateImageWidths(
    width,
    intervals,
    startingWidth,
    incrementSize,
  );

  const sizesArray = generateSizes(widths, aspectRatio);

  return (
    <Component
      srcSet={generateShopifySrcSet(src, sizesArray)}
      alt={alt}
      src={generateImagerySrc(
        src,
        placeholderWidth,
        parseAspectRatio(aspectRatio) * placeholderWidth,
      )}
      width={width}
      sizes={sizes}
      style={{aspectRatio}}
      {...passthroughProps}
    />
  );
}

export function generateShopifySrcSet(
  src = 'https://cdn.shopify.com/static/sample-images/garnished.jpeg',
  sizesArray: Array<{width: number; height: number; crop: Crop}> | undefined,
) {
  if (sizesArray?.length === 0 || !sizesArray) {
    return src;
  }

  return sizesArray
    .map(
      (size) =>
        generateImagerySrc(src, size.width, size.height, size.crop) +
        ' ' +
        size.width +
        'w',
    )
    .join(`, `);
  /*
      Given:
        src = 'https://cdn.shopify.com/static/sample-images/garnished.jpeg'
        sizesArray = [
          {width: 200, height: 200, crop: 'center'},
          {width: 400, height: 400, crop: 'center'},
        ]
      Returns:
        'https://cdn.shopify.com/static/sample-images/garnished.jpeg?width=200&height=200&crop=center 200w, https://cdn.shopify.com/static/sample-images/garnished.jpeg?width=400&height=400&crop=center 400w'
   */
}

export function generateImagerySrc(
  src = 'https://cdn.shopify.com/static/sample-images/garnished.jpeg',
  width: number,
  height: number,
  crop: Crop = 'center',
) {
  const url = new URL(src);
  width && url.searchParams.append('width', width.toString());
  height && url.searchParams.append('height', height.toString());
  crop && url.searchParams.append('crop', crop);
  return url.href;
  /*
    Given:
      src = 'https://cdn.shopify.com/static/sample-images/garnished.jpeg'
      width = 100
      height = 100
      crop = 'center'
    Returns:
      'https://cdn.shopify.com/static/sample-images/garnished.jpeg?width=100&height=100&crop=center'
  */
}

export function generateImageWidths(
  width: string | number = '100%',
  intervals = 20,
  startingWidth = 200,
  incrementSize = 100,
  scale = 1,
) {
  if (width === '100%') {
    return Array.from(
      {length: intervals},
      (_, i) => (i * incrementSize + startingWidth) * scale,
    );
    /* 
      Given: 
        width = '100%'
        intervals = 10
        startingWidth = 100
        incrementSize = 100
      Returns: 
        [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
    */
  }
  // @TODO: if width !== 100% handle relative/fixed sizes: vw/em/rem/px
  return [1000];
}

// Simple utility function to convert 1/1 to [1, 1]
export function parseAspectRatio(aspectRatio: string) {
  const [width, height] = aspectRatio.split('/');
  return Number(width) / Number(height);
  /* 
    Given: 
      '1/1'
    Returns: 
      0.5
  */
}

// Generate data needed for Imagery loader
export function generateSizes(
  widths: number[] | undefined,
  aspectRatio: string,
  crop: Crop = 'center',
) {
  if (!widths) return;
  const sizes = widths.map((width: number) => {
    return {
      width,
      height: width * parseAspectRatio(aspectRatio),
      crop,
    };
  });
  return sizes;
  /* 
    Given: 
      ([100, 200], 1/1, 'center')
    Returns: 
      [{width: 100, height: 100, crop: 'center'}, 
      {width: 200, height: 200, crop: 'center'}]
  */
}
