# Alternative way of using Ganja.js

## Installation

```
yarn add ganja.js
```

## Usage

Include it in your `.ts` file

```
// Use the default export
import Algebra from 'ganja.js'
const PGA2D = Algebra(2,0,1)
```

To list all the basis multivectors

```
console.debug(PGA2D.basis)
```
## Create Objects

Create a point at a given coordinate $(x,y)$ using one of the following techniques

1. Supply the multi-vector coefficients to the constructor
   ```
   const aPoint = new PGA2D(0,0,0,0,-y,x,1)
   // aPoint.nVector(2, -y,x,1)
   ```

2. Use the `nVector` setter function

   ```
   const aPoint = new PGA2D()
   // In PGA2D, points are grade 2
   aPoint.nVector(2 /* grade */, -y, x, 1)
   ```

## Other functions

Given an object `X` created using

```
const X = new PGA2D()
```

The following functions can be called from `X`
using the `X.`_functionName_() syntax

| Name / Syntax                  | Description                                         |
|--------------------------------|-----------------------------------------------------|
| Grade(g)                       | Select only multivectors of the given grade         |
| Even()                         | Select only even grade multivectors                 |
| nVector(grade, _list_of_args_) | Set only a specific grade multivectors              |
| Coeff(_args_)                  | Set the multivector using the provided coefficients |
| toString()                     | Show the coefficient as a string                    |
| Negatitve()                    | Returns the negative of all the coefficients        |
| Reverse()                      | Return the reverse the coefficient                  |
| Involute()                     | Return the involute of all the coefficient          |
| Conjugate()                    | TBD                                                 |
| Dual()                         | TBD                                                 |
| UnDual()                       | TBD                                                 |
| Length                         | TBD                                                 |
| VLength()                      | TBD                                                 |
| Normalized()                   | TBD                                                 |
| Add(Y)                         | Multivector addition                                |
| Scale(s)                       | MultiVector scalar multiplication                   |
| Sub(Y)                         | Multivector subtraction                             |
| Mul(Y)                         | Geometric Product                                   |
| LDot()                         | Left contraction                                    |
| Dot()                          | Symmetric Contraction                               |
| Wedge()                        | Outer product                                       |
| Vee()                          | Join (Dual of Wedge)                                |