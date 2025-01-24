// Base type for a single constraint
type NumericConstraint = {
    type: 'threshold' | 'specificValue' | 'range' | 'seriesOfRanges';
};

// Threshold constraint: an array of numbers
type ThresholdConstraint = NumericConstraint & {
    type: 'threshold';
    values: number[];
};

// Specific value constraint: a single number
type SpecificValueConstraint = NumericConstraint & {
    type: 'specificValue';
    value: number;
};

// Range constraint: a min and max value
type RangeConstraint = NumericConstraint & {
    type: 'range';
    min: number;
    max: number;
};

// Series of ranges constraint: an array of ranges
type SeriesOfRangesConstraint = NumericConstraint & {
    type: 'seriesOfRanges';
    ranges: { min: number; max: number }[];
};

// Union type for all possible constraints
export type NumericEncodingConstraint =
    | ThresholdConstraint
    | SpecificValueConstraint
    | RangeConstraint
    | SeriesOfRangesConstraint;


type CategoricalConstraint = {
    type: 'allowedCategories' | 'singleValue' | 'mutuallyExclusive';
};

// Allowed categories constraint
type AllowedCategoriesConstraint = CategoricalConstraint & {
    type: 'allowedCategories';
    categories: string[];
};

// Single value constraint
type SingleValueConstraint = CategoricalConstraint & {
    type: 'singleValue';
    value: string;
};

// Mutually exclusive categories constraint
type MutuallyExclusiveConstraint = CategoricalConstraint & {
    type: 'mutuallyExclusive';
    categories: string[];
};

// Union type for all categorical constraints
export type CategoricalEncodingConstraint =
    | AllowedCategoriesConstraint
    | SingleValueConstraint
    | MutuallyExclusiveConstraint;