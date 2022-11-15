import {type LoaderArgs} from '@hydrogen/remix';
import {FetcherWithComponents, useFetcher} from '@remix-run/react';
import {flattenConnection} from '@shopify/hydrogen-react';
import {
  Product,
  ProductConnection,
  ProductSortKeys,
} from '@shopify/hydrogen-react/storefront-api-types';
import {useEffect} from 'react';
import {json} from 'react-router';
import invariant from 'tiny-invariant';
import {getLocalizationFromLang} from '~/lib/utils';

interface GetProductsProps {
  products: Product[] | [];
  state: FetcherWithComponents<any>['state'];
  count: number;
}

export async function loader({
  request,
  params,
  context: {storefront},
}: LoaderArgs) {
  const {language, country} = getLocalizationFromLang(params.lang);
  const url = new URL(request.url);

  const searchParams = new URLSearchParams(url.searchParams);
  const sortKey = searchParams.get('sortKey') ?? 'BEST_SELLING';
  let count;
  try {
    const _count = searchParams.get('count');
    if (typeof _count === 'string') {
      count = parseInt(_count);
    }
  } catch (_) {
    count = 4;
  }

  const {products} = await storefront.query<{
    products: ProductConnection;
  }>({
    query: PRODUCTS_QUERY,
    variables: {
      count,
      sortKey,
      country,
      language,
    },
    cache: storefront.CacheLong(),
  });

  invariant(products, 'No data returned from top products query');

  return json({
    products: flattenConnection(products as ProductConnection),
  });
}

export default function ProductsComponentRoute() {
  return null;
}

export function Products({
  children,
  count = 4,
  sortKey = 'BEST_SELLING',
}: {
  children: (props: GetProductsProps) => JSX.Element;
  count?: number;
  sortKey?: ProductSortKeys;
}) {
  const {load, data, state} = useFetcher();

  useEffect(() => {
    load(`/GetProducts?count=${count}&sortKey=${sortKey}`);
  }, [load, count, sortKey]);

  const products = (data?.products ?? []) as Product[];

  return children({products, count, state});
}

const PRODUCTS_QUERY = `#graphql
  fragment ProductCard on Product {
    id
    title
    publishedAt
    handle
    variants(first: 1) {
      nodes {
        id
        image {
          url
          altText
          width
          height
        }
        price {
          amount
          currencyCode
        }
        compareAtPrice {
          amount
          currencyCode
        }
      }
    }
  }
  query (
    $count: Int
    $country: CountryCode
    $language: LanguageCode
    $sortKey: ProductSortKeys
  ) @inContext(country: $country, language: $language) {
    products(first: $count, sortKey: $sortKey) {
      nodes {
        ...ProductCard
      }
    }
  }
`;